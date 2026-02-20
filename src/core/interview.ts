import { join } from 'path'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { resolveIssueFile } from '@/core/batch'
import { createInterface } from 'readline'
import { ResultAsync } from 'neverthrow'
import { z } from 'zod'
import type { Config } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { runClaudeIteration } from '@/core/claude'
import { createLogger } from '@/utils/logger'

// Embedded at compile time via Bun import attribute
import interviewPromptTemplate from '@/prompts/PROMPT_interview.md' with { type: 'text' }

const logger = createLogger('interview')

/** Max interview turns before giving up and marking the issue as sufficiently specified. */
const MAX_TURNS = 10

/** Schema for the questions file Claude writes during an interview turn. */
const QuestionsFileSchema = z.union([
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

type QuestionsFile = z.infer<typeof QuestionsFileSchema>

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
 * Injects interview-specific template variables into a prompt string.
 *
 * @param template - Raw prompt template with `$BARF_*` placeholders.
 * @param vars - Values to substitute.
 * @returns Prompt with all placeholders replaced.
 */
function injectInterviewVars(
  template: string,
  vars: {
    issueId: string
    issueFile: string
    priorQA: string
    questionsFile: string
  }
): string {
  return template
    .replace(/\$\{?BARF_ISSUE_ID\}?/g, vars.issueId)
    .replace(/\$\{?BARF_ISSUE_FILE\}?/g, vars.issueFile)
    .replace(/\$\{?PRIOR_QA\}?/g, vars.priorQA || '(none yet)')
    .replace(/\$\{?BARF_QUESTIONS_FILE\}?/g, vars.questionsFile)
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
 * Runs the interactive interview loop for an issue.
 *
 * Each turn calls Claude with the interview prompt and checks whether Claude
 * wrote a questions file. If questions are present, they are presented to the
 * user interactively. Accumulated Q&A is injected into subsequent prompts.
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
 * @returns `ok(void)` when the interview completes, `err(Error)` on I/O or Claude failure.
 */
export function interviewLoop(
  issueId: string,
  config: Config,
  provider: IssueProvider
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<void> => {
      const questionsFile = join(config.barfDir, `${issueId}-interview.json`)
      const issueFile = resolveIssueFile(issueId, config)
      const priorQA: QAPair[] = []

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const priorQAText =
          priorQA.length > 0
            ? priorQA.map(({ question, answer }) => `Q: ${question}\nA: ${answer}`).join('\n\n')
            : ''

        // Clean up any leftover questions file before this turn
        if (existsSync(questionsFile)) {
          unlinkSync(questionsFile)
        }

        const prompt = injectInterviewVars(interviewPromptTemplate, {
          issueId,
          issueFile,
          priorQA: priorQAText,
          questionsFile
        })

        logger.info({ issueId, turn }, 'running interview turn')

        const iterResult = await runClaudeIteration(prompt, config.interviewModel, config, issueId)
        if (iterResult.isErr()) {
          throw iterResult.error
        }

        if (iterResult.value.outcome === 'error') {
          logger.warn({ issueId, turn }, 'claude returned error during interview — stopping')
          break
        }

        if (iterResult.value.outcome === 'rate_limited') {
          const resetsAt = iterResult.value.rateLimitResetsAt
          const timeStr = resetsAt ? new Date(resetsAt * 1000).toLocaleTimeString() : 'soon'
          throw new Error(`Rate limited until ${timeStr}`)
        }

        // Check whether Claude wrote the questions file
        if (!existsSync(questionsFile)) {
          logger.info({ issueId, turn }, 'no questions file written — interview complete')
          break
        }

        let parsed: QuestionsFile
        try {
          const raw = readFileSync(questionsFile, 'utf-8')
          unlinkSync(questionsFile)
          const result = QuestionsFileSchema.safeParse(JSON.parse(raw))
          if (!result.success) {
            logger.warn({ issueId, turn }, 'questions file has unexpected shape — stopping')
            break
          }
          parsed = result.data
        } catch {
          logger.warn({ issueId, turn }, 'could not parse questions file — stopping')
          break
        }

        if ('complete' in parsed && parsed.complete) {
          logger.info({ issueId, turn }, 'interview_complete signal received')
          break
        }

        if ('questions' in parsed && parsed.questions.length > 0) {
          process.stdout.write(`\n[barf] Clarifying issue ${issueId}...\n`)
          for (const q of parsed.questions) {
            const answer = await askQuestion(q.question, q.options)
            priorQA.push({ question: q.question, answer })
          }
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
