import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { ResultAsync } from 'neverthrow'
import type { Config, DisplayContext } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { injectTemplateVars } from '@/core/context'
import { execFileNoThrow, type ExecResult } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

/**
 * Injectable subprocess function — mirrors {@link execFileNoThrow}'s signature.
 * Pass a mock in tests to avoid spawning a real claude process.
 */
export type ExecFn = (file: string, args?: string[]) => Promise<ExecResult>

const logger = createLogger('triage')

// Built-in triage prompt — embedded at compile time via Bun import attribute
import triagePromptTemplate from '@/prompts/PROMPT_triage.md' with { type: 'text' }

/** JSON shape Claude must return for a triage evaluation. */
const TriageResultSchema = z.union([
  z.object({ needs_interview: z.literal(false) }),
  z.object({
    needs_interview: z.literal(true),
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).optional()
      })
    )
  })
])

type TriageResult = z.infer<typeof TriageResultSchema>

/**
 * Formats the questions from a triage result as a numbered markdown list
 * suitable for appending to an issue body under `## Interview Questions`.
 */
function formatQuestionsSection(result: TriageResult & { needs_interview: true }): string {
  const items = result.questions
    .map((q, i) => {
      const opts = q.options?.map(o => `   - ${o}`).join('\n') ?? ''
      return opts ? `${i + 1}. ${q.question}\n${opts}` : `${i + 1}. ${q.question}`
    })
    .join('\n')
  return `\n\n## Interview Questions\n\n${items}`
}

/**
 * Resolves the full path of an issue file given its ID and config.
 * Falls back to the issue ID string when no local file exists (GitHub provider).
 */
function resolveIssueFilePath(issueId: string, config: Config): string {
  const md = join(config.issuesDir, `${issueId}.md`)
  return existsSync(md) ? md : issueId
}

/**
 * Loads the triage prompt template.
 * When `config.promptDir` is set, checks for a custom `PROMPT_triage.md` override.
 */
function loadTriagePrompt(config: Config): string {
  if (config.promptDir) {
    const custom = join(config.promptDir, 'PROMPT_triage.md')
    if (existsSync(custom)) {
      logger.info({ path: custom }, 'using custom triage prompt')
      return readFileSync(custom, 'utf-8')
    }
  }
  return triagePromptTemplate
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
 */
async function triageIssueImpl(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  execFn: ExecFn,
  displayContext: DisplayContext | undefined
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
  const prompt = injectTemplateVars(loadTriagePrompt(config), {
    BARF_ISSUE_ID: issueId,
    BARF_ISSUE_FILE: issueFile
  })

  logger.info({ issueId, model: config.triageModel }, 'triaging issue')

  if (displayContext && process.stderr.isTTY) {
    const rawTitle = displayContext.title
    const title = rawTitle.length > 50 ? rawTitle.slice(0, 47) + '...' : rawTitle
    process.stderr.write(
      `▶ ${displayContext.mode}  ${displayContext.issueId}  ${displayContext.state}  ${title}\n`
    )
  }

  let execResult: ExecResult
  try {
    execResult = await execFn('claude', [
      '-p',
      prompt,
      '--model',
      config.triageModel,
      '--output-format',
      'text'
    ])
  } finally {
    if (displayContext && process.stderr.isTTY) {
      process.stderr.write('\x1b[1A\r\x1b[K')
    }
  }

  if (execResult.status !== 0) {
    throw new Error(`Claude triage failed (exit ${execResult.status}): ${execResult.stderr.trim()}`)
  }

  let parsed: TriageResult
  try {
    // Strip markdown code fences Claude sometimes adds despite instructions
    const raw = execResult.stdout
      .trim()
      .replace(/^```(?:json)?\n?([\s\S]*?)\n?```$/m, '$1')
      .trim()
    const parseResult = TriageResultSchema.safeParse(JSON.parse(raw))
    if (!parseResult.success) {
      throw new Error(`Unexpected triage JSON shape: ${JSON.stringify(parseResult.error.issues)}`)
    }
    parsed = parseResult.data
  } catch (e) {
    throw new Error(`Failed to parse triage response: ${toError(e).message}`)
  }

  if (!parsed.needs_interview) {
    const writeResult = await provider.writeIssue(issueId, { needs_interview: false })
    if (writeResult.isErr()) {
      throw writeResult.error
    }
    logger.info({ issueId }, 'triage: issue is well-specified')
    return
  }

  // Append Interview Questions section to issue body
  const questionsSection = formatQuestionsSection(parsed)
  const writeResult = await provider.writeIssue(issueId, {
    needs_interview: true,
    body: issue.body + questionsSection
  })
  if (writeResult.isErr()) {
    throw writeResult.error
  }

  logger.info({ issueId, questions: parsed.questions.length }, 'triage: issue needs interview')
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
 */
export function triageIssue(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  execFn: ExecFn = execFileNoThrow,
  displayContext?: DisplayContext
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    triageIssueImpl(issueId, config, provider, execFn, displayContext),
    toError
  )
}
