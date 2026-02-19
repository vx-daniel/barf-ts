import { spawn } from 'bun'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { ResultAsync } from 'neverthrow'
import type { Config } from '@/types'
import { parseClaudeStream, ContextOverflowError, RateLimitError } from '@/core/context'
import { createLogger } from '@/utils/logger'

const logger = createLogger('claude')

/**
 * Outcome of a single Claude agent iteration.
 * - `success`: iteration completed normally
 * - `overflow`: context threshold exceeded (see {@link ContextOverflowError})
 * - `error`: Claude exited with a non-success status or timed out
 * - `rate_limited`: API rate limit hit; see `rateLimitResetsAt` for retry time
 *
 * @category Claude Agent
 */
export type IterationOutcome = 'success' | 'overflow' | 'error' | 'rate_limited'

/**
 * Result of a single Claude agent iteration, returned by {@link runClaudeIteration}.
 *
 * `tokens` is always populated. `rateLimitResetsAt` is set only when `outcome === 'rate_limited'`.
 *
 * @category Claude Agent
 */
export interface IterationResult {
  outcome: IterationOutcome
  tokens: number
  rateLimitResetsAt?: number
}

// Context window limits per model (tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-haiku-4-5-20251001': 200_000
}

/**
 * Computes the token threshold at which barf interrupts a Claude session.
 * threshold = floor(contextUsagePercent% × modelLimit)
 *
 * @category Claude Agent
 */
export function getThreshold(model: string, contextUsagePercent: number): number {
  const limit = MODEL_CONTEXT_LIMITS[model] ?? 200_000
  return Math.floor((contextUsagePercent / 100) * limit)
}

/**
 * Spawns the `claude` CLI and runs a single agent iteration.
 * Prompt is passed via stdin. Never throws — all errors are captured in the result.
 *
 * Key env override: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=100` disables Claude Code
 * auto-compact so barf can track context and interrupt at the configured threshold itself.
 *
 * @param prompt - Full prompt text; sent to the claude process via stdin.
 * @param model - Claude model identifier (e.g. `'claude-sonnet-4-6'`).
 * @param config - Loaded barf configuration (timeout, context percent, stream log dir).
 * @param issueId - When set, stream output is appended to `config.streamLogDir/<issueId>.jsonl`.
 * @returns `ok(IterationResult)` on success, `err(Error)` if the process spawn fails unexpectedly.
 * @category Claude Agent
 */
export function runClaudeIteration(
  prompt: string,
  model: string,
  config: Config,
  issueId?: string
): ResultAsync<IterationResult, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<IterationResult> => {
      const threshold = getThreshold(model, config.contextUsagePercent)
      const isTTY = process.stderr.isTTY ?? false
      let timedOut = false
      let lastTool = ''

      const proc = spawn({
        cmd: [
          'claude',
          '-p',
          '--dangerously-skip-permissions',
          '--output-format',
          'stream-json',
          '--model',
          model
        ],
        stdin: Buffer.from(prompt),
        stdout: 'pipe',
        stderr: 'inherit',
        env: { ...process.env, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '100' }
      })

      const timeoutHandle =
        config.claudeTimeout > 0
          ? setTimeout(() => {
              timedOut = true
              proc.kill('SIGTERM' as Parameters<typeof proc.kill>[0])
            }, config.claudeTimeout * 1000)
          : null

      // Wrap proc to match parseClaudeStream's kill signature (string → Bun Signals)
      const procAdapter = {
        stdout: proc.stdout as ReadableStream<Uint8Array>,
        kill: (signal?: string) => proc.kill(signal as Parameters<typeof proc.kill>[0])
      }

      let streamLogFile: string | undefined
      if (config.streamLogDir && issueId) {
        mkdirSync(config.streamLogDir, { recursive: true })
        streamLogFile = join(config.streamLogDir, `${issueId}.jsonl`)
      }

      let lastTokens = 0
      try {
        for await (const event of parseClaudeStream(procAdapter, threshold, streamLogFile)) {
          if (event.type === 'usage') {
            lastTokens = event.tokens
            logger.debug({ tokens: event.tokens, threshold }, 'context update')
            if (isTTY) {
              const pct = Math.round((event.tokens / threshold) * 100)
              const toolPart = lastTool ? `  |  ${lastTool}` : ''
              process.stderr.write(
                `\r\x1b[K  context: ${event.tokens.toLocaleString()} / ${threshold.toLocaleString()} (${pct}%)${toolPart}`
              )
            }
          } else if (event.type === 'tool') {
            lastTool = event.name
            logger.debug({ tool: event.name }, 'tool call')
          }
        }
        if (isTTY) {
          process.stderr.write('\r\x1b[K')
      }
        await proc.exited
        if (timedOut) {
          logger.warn({ model, timeout: config.claudeTimeout }, 'claude timed out')
          return { outcome: 'error', tokens: lastTokens }
        }
        return { outcome: 'success', tokens: lastTokens }
      } catch (e) {
        if (e instanceof ContextOverflowError) {
          return { outcome: 'overflow', tokens: e.tokens }
        }
        if (e instanceof RateLimitError) {
          return {
            outcome: 'rate_limited',
            tokens: lastTokens,
            rateLimitResetsAt: e.resetsAt
          }
        }
        throw e
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }
      }
    })(),
    e => (e instanceof Error ? e : new Error(String(e)))
  )
}
