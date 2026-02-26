/**
 * Triage orchestration — one-shot Claude evaluation of NEW issues.
 *
 * Evaluates whether a NEW issue needs further refinement (interview) before
 * planning can proceed. Uses a one-shot Claude call with the triage prompt
 * template. The result is either `needs_interview=false` (ready for planning)
 * or `needs_interview=true` with appended interview questions.
 *
 * @module Triage
 */
import { existsSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { ResultAsync } from 'neverthrow'
import type { Config, DisplayContext } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { injectTemplateVars } from '@/core/context'
import { resolvePromptTemplate } from '@/core/prompts'
import { createSessionStats, persistSessionStats } from '@/core/batch/stats'
import { execFileNoThrow, type ExecResult } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import { formatQuestionsSection, parseTriageResponse } from './parse'

/** Usage token counts extracted from the Claude CLI JSON envelope. */
const UsageSchema = z.object({
  input_tokens: z.number().default(0),
  output_tokens: z.number().default(0),
  cache_creation_input_tokens: z.number().default(0),
  cache_read_input_tokens: z.number().default(0),
})

/**
 * Old single-object format from `--output-format json` (kept for test compatibility).
 * Shape: `{ result: string, usage: {...} }`
 */
const ClaudeJsonOutputSchema = z.object({
  result: z.string(),
  usage: UsageSchema,
})

/** Array-format item with `type: "result"` — carries the final text result. */
const ClaudeResultItemSchema = z.object({
  type: z.literal('result'),
  result: z.string(),
})

/** Array-format item with `type: "assistant"` — carries token usage. */
const ClaudeAssistantItemSchema = z.object({
  type: z.literal('assistant'),
  message: z.object({ usage: UsageSchema }),
})

/** Normalized envelope shape used internally after parsing either format. */
type ClaudeEnvelope = z.infer<typeof ClaudeJsonOutputSchema>

/**
 * Normalizes the raw Claude CLI JSON output to a consistent `{ result, usage }` shape.
 *
 * The Claude CLI `--output-format json` has two observed formats:
 * - **Array** (current CLI): streaming event objects; `result` comes from the
 *   `type: "result"` element and `usage` from the `type: "assistant"` element.
 * - **Object** (older CLI / tests): direct `{ result, usage }` envelope.
 *
 * @param raw - Parsed JSON value from Claude CLI stdout.
 * @returns `ok(envelope)` with normalized data, or `err(Error)` if neither format matches.
 */
function parseClaudeEnvelope(raw: unknown): ClaudeEnvelope {
  if (Array.isArray(raw)) {
    const resultItem = raw.find(
      (item) => ClaudeResultItemSchema.safeParse(item).success,
    )
    const assistantItem = raw.find(
      (item) => ClaudeAssistantItemSchema.safeParse(item).success,
    )

    if (!resultItem) {
      throw new Error(
        `Claude JSON array missing a type:"result" element. Got types: ${raw.map((i: { type?: unknown }) => i?.type).join(', ')}`,
      )
    }

    const result = ClaudeResultItemSchema.parse(resultItem).result
    const usage = assistantItem
      ? ClaudeAssistantItemSchema.parse(assistantItem).message.usage
      : {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        }

    return { result, usage }
  }

  const parsed = ClaudeJsonOutputSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `Unexpected Claude JSON envelope: ${JSON.stringify(parsed.error.issues)}`,
    )
  }
  return parsed.data
}

/**
 * Injectable subprocess function — mirrors {@link execFileNoThrow}'s signature.
 * Pass a mock in tests to avoid spawning a real Claude process.
 *
 * @category Triage
 */
export type ExecFn = (file: string, args?: string[]) => Promise<ExecResult>

const logger = createLogger('triage')

/**
 * Resolves the full path of an issue file given its ID and config.
 * Falls back to the issue ID string when no local file exists (GitHub provider).
 */
function resolveIssueFilePath(issueId: string, config: Config): string {
  const md = join(config.issuesDir, `${issueId}.md`)
  return existsSync(md) ? md : issueId
}

/**
 * Evaluates a single NEW issue with a one-shot Claude call to determine whether
 * it needs further refinement before planning can proceed.
 *
 * Skips issues where `needs_interview` is already set (already triaged).
 * On completion, sets `needs_interview=false` or `needs_interview=true` and
 * appends a `## Interview Questions` section to the issue body when questions exist.
 *
 * @param issueId - ID of the issue to triage.
 * @param config - Loaded barf configuration (triageModel, dirs, etc.).
 * @param provider - Issue provider for reading and writing the issue.
 * @param execFn - Subprocess runner; defaults to {@link execFileNoThrow}. Injectable for tests.
 * @param displayContext - When set, a sticky header line is shown on TTY stderr during the triage call.
 * @returns `ok(void)` on success or skip, `err(Error)` on I/O or Claude failure.
 * @category Triage
 */
export function triageIssue(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  execFn: ExecFn = execFileNoThrow,
  displayContext?: DisplayContext,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    triageIssueImpl(issueId, config, provider, execFn, displayContext),
    toError,
  )
}

/**
 * Internal implementation of triageIssue.
 * Separated so the public API can wrap in ResultAsync.
 */
async function triageIssueImpl(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  execFn: ExecFn,
  displayContext: DisplayContext | undefined,
): Promise<void> {
  const fetchResult = await provider.fetchIssue(issueId)
  if (fetchResult.isErr()) {
    throw fetchResult.error
  }

  const issue = fetchResult.value

  // Skip if already triaged
  if (issue.needs_interview !== undefined) {
    logger.debug({ issueId }, 'skipping — already triaged')
    return
  }

  const issueFile = resolveIssueFilePath(issueId, config)
  const prompt = injectTemplateVars(resolvePromptTemplate('triage', config), {
    BARF_ISSUE_ID: issueId,
    BARF_ISSUE_FILE: issueFile,
  })

  logger.info({ issueId, model: config.triageModel }, 'triaging issue')

  if (displayContext && process.stderr.isTTY) {
    const rawTitle = displayContext.title
    const title =
      rawTitle.length > 50 ? `${rawTitle.slice(0, 47)}...` : rawTitle
    process.stderr.write(
      `▶ ${displayContext.mode}  ${displayContext.issueId}  ${displayContext.state}  ${title}\n`,
    )
  }

  const sessionStartTime = Date.now()
  let execResult: ExecResult
  try {
    execResult = await execFn('claude', [
      '-p',
      prompt,
      '--model',
      config.triageModel,
      '--output-format',
      'json',
    ])
  } finally {
    if (displayContext && process.stderr.isTTY) {
      process.stderr.write('\x1b[1A\r\x1b[K')
    }
  }

  if (execResult.status !== 0) {
    throw new Error(
      `Claude triage failed (exit ${execResult.status}): ${execResult.stderr.trim()}`,
    )
  }

  const { result: resultText, usage } = parseClaudeEnvelope(
    JSON.parse(execResult.stdout),
  )
  const inputTokens =
    usage.input_tokens +
    usage.cache_creation_input_tokens +
    usage.cache_read_input_tokens
  const parsed = parseTriageResponse(resultText)

  if (!parsed.needs_interview) {
    const writeResult = await provider.writeIssue(issueId, {
      needs_interview: false,
      state: 'GROOMED',
    })
    if (writeResult.isErr()) {
      throw writeResult.error
    }
    logger.info({ issueId }, 'triage: issue is well-specified → GROOMED')
  } else {
    // Append Interview Questions section to issue body — stays in NEW
    const questionsSection = formatQuestionsSection(parsed)
    const writeResult = await provider.writeIssue(issueId, {
      needs_interview: true,
      body: issue.body + questionsSection,
    })
    if (writeResult.isErr()) {
      throw writeResult.error
    }
    logger.info(
      { issueId, questions: parsed.questions.length },
      'triage: issue needs interview',
    )
  }

  const stats = createSessionStats(
    sessionStartTime,
    inputTokens,
    usage.output_tokens,
    inputTokens,
    1,
    config.triageModel,
  )
  await persistSessionStats(issueId, stats, provider)
}
