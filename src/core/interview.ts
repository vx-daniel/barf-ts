import { createInterface } from 'readline'
import { ResultAsync } from 'neverthrow'
import { z } from 'zod'
import type { Config, ClaudeEvent } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { runSdkTurn } from '@/core/claude-sdk'
import { resolveIssueFile } from '@/core/batch'
import { createLogger } from '@/utils/logger'

// Embedded at compile time via Bun import attribute
import interviewPromptTemplate from '@/prompts/PROMPT_interview.md' with { type: 'text' }

const logger = createLogger('interview')

/** Max interview turns before giving up and marking the issue as sufficiently specified. */
const MAX_TURNS = 10

/**
 * JSON schema passed to the SDK `outputFormat` option as the `StructuredOutput` tool's
 * `input_schema`. Uses a flat object with optional `complete` and `questions` properties
 * (the Anthropic API requires `type: "object"` at the root — `oneOf` is not supported).
 * The stricter union constraint is enforced by {@link QuestionsOutputSchema} at parse time.
 */
const outputSchema: Record<string, unknown> = {
  type: 'object',
  properties: {
    complete: { type: 'boolean' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } }
        },
        required: ['question'],
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
}

/** Schema for validating the structured output Claude returns each interview turn. */
const QuestionsOutputSchema = z.union([
  z.object({ complete: z.literal(true) }),
  z.object({
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).optional()
      })
    )
  })
])

type QuestionsOutput = z.infer<typeof QuestionsOutputSchema>

interface QAPair {
  question: string
  answer: string
}

/**
 * Reads a single line from stdin with a prompt prefix.
 * Used for interactive terminal Q&A during the interview loop.
 */
async function readLine(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Presents a single interview question to the user and collects their answer.
 * Numbered options are printed when `options` is provided; otherwise free-text.
 *
 * @param question - Question text to display.
 * @param options - Optional multiple-choice answers. An implicit "Other" option is added.
 * @returns The user's answer as a string.
 */
async function askQuestion(question: string, options?: string[]): Promise<string> {
  process.stdout.write(`\n${question}\n`)
  if (options && options.length > 0) {
    options.forEach((opt, i) => process.stdout.write(`  ${i + 1}. ${opt}\n`))
    process.stdout.write(`  ${options.length + 1}. Other\n`)
    const choice = await readLine('Choice: ')
    const num = parseInt(choice, 10)
    if (num >= 1 && num <= options.length) {
      return options[num - 1]!
    }
    return readLine('Your answer: ')
  }
  return readLine('Answer: ')
}

/**
 * Formats accumulated Q&A pairs as a markdown section for appending to the issue body.
 *
 * @param pairs - List of question/answer pairs from the interview.
 * @returns Markdown `## Interview Q&A` section string.
 */
function formatQASection(pairs: QAPair[]): string {
  if (pairs.length === 0) {
    return ''
  }
  const items = pairs.map(({ question, answer }) => `**Q: ${question}**\nA: ${answer}`).join('\n\n')
  return `\n\n## Interview Q&A\n\n${items}`
}

/**
 * Runs the interactive interview loop for an issue using the Claude Agent SDK.
 *
 * Turn 0 sends the full initial prompt via {@link query}. Subsequent turns resume the same
 * SDK session with `resume: sessionId` and send only the user's answers — the SDK maintains
 * full conversation history natively, eliminating `$PRIOR_QA` prompt injection.
 *
 * Structured output (`outputFormat: json_schema`) delivers Claude's decision
 * directly in `msg.structured_output`; no temp file I/O required.
 *
 * On completion (Claude signals `complete: true` or max turns reached),
 * the Q&A is appended to the issue body.
 *
 * The caller is responsible for state transitions (NEW → INTERVIEWING before,
 * INTERVIEWING → PLANNED after).
 *
 * @param issueId - ID of the issue being interviewed.
 * @param config - Loaded barf configuration (model, dirs, etc.).
 * @param provider - Issue provider for reading and writing the issue.
 * @param onEvent - Optional callback fired for each {@link ClaudeEvent} during a turn.
 * @param signal - Optional abort signal; aborts the active SDK query on trigger.
 * @param promptUser - Optional callback for collecting answers from the user. When omitted,
 *   falls back to readline on stdin (CLI mode). Provide this in TUI contexts to route
 *   Q&A through the UI instead of raw terminal I/O.
 * @returns `ok(void)` when the interview completes, `err(Error)` on I/O or SDK failure.
 */
export function interviewLoop(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  onEvent?: (event: ClaudeEvent) => void,
  signal?: AbortSignal,
  promptUser?: (question: string, options?: string[]) => Promise<string>
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<void> => {
      const issueFile = resolveIssueFile(issueId, config)
      const priorQA: QAPair[] = []
      const abortController = new AbortController()
      signal?.addEventListener('abort', () => abortController.abort(), { once: true })

      const initialPrompt = interviewPromptTemplate
        .replace(/\$\{?BARF_ISSUE_ID\}?/g, issueId)
        .replace(/\$\{?BARF_ISSUE_FILE\}?/g, issueFile)

      let sessionId: string | undefined
      let lastTurnAnswers: QAPair[] = []

      outer: for (let turn = 0; turn < MAX_TURNS; turn++) {
        const prompt =
          turn === 0
            ? initialPrompt
            : lastTurnAnswers
                .map(({ question, answer }) => `Q: ${question}\nA: ${answer}`)
                .join('\n\n')

        logger.info({ issueId, turn }, 'running interview turn')
        onEvent?.({ type: 'status', message: turn === 0 ? 'Reviewing issue…' : 'Reassessing…' })

        const turnRes = await runSdkTurn(prompt, {
          model: config.interviewModel,
          systemPrompt:
            'You are a requirements analyst. Read the issue file you are given, then decide whether to ask clarifying questions or signal completion.',
          tools: ['Read'],
          outputSchema,
          sessionId,
          abortController,
          onEvent,
          onStderr: (data: string) => logger.info({ issueId, turn }, data.trimEnd()),
          issueId,
          turn,
          streamLogDir: config.streamLogDir || undefined
        })

        if (turnRes.isErr()) {
          throw turnRes.error
        }
        sessionId = turnRes.value.sessionId

        let parsed: QuestionsOutput | undefined

        if (turnRes.value.structuredOutput !== undefined) {
          const parseResult = QuestionsOutputSchema.safeParse(turnRes.value.structuredOutput)
          if (parseResult.success) {
            parsed = parseResult.data
          } else {
            logger.warn(
              { issueId, turn, error: parseResult.error.message },
              'structured output has unexpected shape — stopping'
            )
          }
        }

        if (!parsed) {
          logger.info({ issueId, turn }, 'no structured output — interview complete')
          onEvent?.({ type: 'status', message: 'Interview complete.' })
          break outer
        }

        if ('complete' in parsed && parsed.complete) {
          logger.info({ issueId, turn }, 'interview_complete signal received')
          onEvent?.({ type: 'status', message: 'Issue is well-specified — no questions needed.' })
          break outer
        }

        if ('questions' in parsed && parsed.questions.length > 0) {
          if (!promptUser) {
            process.stdout.write(`\n[barf] Clarifying issue ${issueId}...\n`)
          }
          lastTurnAnswers = []
          for (const q of parsed.questions) {
            const answer = promptUser
              ? await promptUser(q.question, q.options)
              : await askQuestion(q.question, q.options)
            priorQA.push({ question: q.question, answer })
            lastTurnAnswers.push({ question: q.question, answer })
          }
        } else {
          break outer
        }
      }

      // Append Q&A to issue body if any was collected
      if (priorQA.length > 0) {
        const issueResult = await provider.fetchIssue(issueId)
        if (issueResult.isOk()) {
          const qaSection = formatQASection(priorQA)
          const writeResult = await provider.writeIssue(issueId, {
            body: issueResult.value.body + qaSection
          })
          if (writeResult.isErr()) {
            logger.warn({ issueId, err: writeResult.error.message }, 'failed to write Q&A to issue')
          }
        }
      }
    })(),
    e => (e instanceof Error ? e : new Error(String(e)))
  )
}
