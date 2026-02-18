import { spawn } from 'bun'
import { ResultAsync } from 'neverthrow'
import type { Config } from '@/types/index'
import { parseClaudeStream, ContextOverflowError, RateLimitError } from '@/core/context'
import { createLogger } from '@/utils/logger'

const logger = createLogger('claude')

export type IterationOutcome = 'success' | 'overflow' | 'error' | 'rate_limited'

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
 */
export function getThreshold(model: string, contextUsagePercent: number): number {
  const limit = MODEL_CONTEXT_LIMITS[model] ?? 200_000
  return Math.floor((contextUsagePercent / 100) * limit)
}

/**
 * Spawns the `claude` CLI and runs a single agent iteration.
 * Prompt is passed via stdin. Returns ResultAsync — never throws.
 *
 * Key env override:
 *   CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=100  disables Claude Code auto-compact so
 *   barf can track context and interrupt at the configured threshold itself.
 */
export function runClaudeIteration(
  prompt: string,
  model: string,
  config: Config
): ResultAsync<IterationResult, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<IterationResult> => {
      const threshold = getThreshold(model, config.contextUsagePercent)
      let timedOut = false

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

      let lastTokens = 0
      try {
        for await (const event of parseClaudeStream(procAdapter, threshold)) {
          if (event.type === 'usage') {
            lastTokens = event.tokens
            logger.debug({ tokens: event.tokens }, 'context update')
          } else if (event.type === 'tool') {
            logger.debug({ tool: event.name }, 'tool call')
          }
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
