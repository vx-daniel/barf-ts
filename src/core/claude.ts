import { spawn } from 'bun'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { ResultAsync } from 'neverthrow'
import type { Config } from '@/types'
import type { IterationResult } from '@/types/schema/claude-schema'
import { parseClaudeStream, ContextOverflowError, RateLimitError } from '@/core/context'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

export type { IterationOutcome, IterationResult } from '@/types/schema/claude-schema'

const logger = createLogger('claude')

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

/** Proc-like interface matching Bun.spawn() shape — enables testing without mocking Bun. */
export interface ClaudeProc {
  stdout: ReadableStream<Uint8Array>
  kill: (signal?: string) => void
  exited: Promise<number>
}

/** Options for stream consumption, injected by caller. */
export interface ConsumeStreamOptions {
  threshold: number
  contextLimit: number
  streamLogFile?: string
  isTTY?: boolean
  stderrWrite?: (data: string) => void
}

/**
 * Consumes a Claude process's stdout stream, tracking token usage and tool calls.
 * Returns an {@link IterationResult} based on how the stream terminates.
 *
 * Extracted from {@link runClaudeIteration} to allow testing without mocking
 * `bun` or `parseClaudeStream` — callers inject a {@link ClaudeProc} and
 * {@link ConsumeStreamOptions} directly.
 *
 * @param proc - Process-like object with stdout stream, kill method, and exit promise.
 * @param opts - Stream consumption options (threshold, context limit, TTY config).
 * @param signal - When aborted, treated as a timeout — the result is `{ outcome: 'error' }`.
 * @returns `IterationResult` with outcome and token count.
 * @category Claude Agent
 */
export async function consumeClaudeStream(
  proc: ClaudeProc,
  opts: ConsumeStreamOptions,
  signal?: AbortSignal
): Promise<IterationResult> {
  const { threshold, contextLimit, streamLogFile, isTTY = false, stderrWrite } = opts
  const write = stderrWrite ?? ((data: string) => process.stderr.write(data))
  let lastTokens = 0
  let lastTool = ''

  const onAbort = () => proc.kill('SIGTERM')
  if (signal) {
    if (signal.aborted) {
      onAbort()
    } else {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  try {
    for await (const event of parseClaudeStream(proc, threshold, streamLogFile)) {
      if (event.type === 'usage') {
        lastTokens = event.tokens
        logger.debug({ tokens: event.tokens, threshold }, 'context update')
        if (isTTY) {
          const pct = Math.round((event.tokens / contextLimit) * 100)
          const toolPart = lastTool ? `  |  ${lastTool}` : ''
          write(
            `\r\x1b[K  context: ${event.tokens.toLocaleString()} / ${contextLimit.toLocaleString()} (${pct}%)${toolPart}`
          )
        }
      } else if (event.type === 'tool') {
        lastTool = event.name
        logger.debug({ tool: event.name }, 'tool call')
      }
    }
    if (isTTY) {
      write('\r\x1b[K')
    }
    await proc.exited
    if (signal?.aborted) {
      logger.warn({ threshold }, 'claude timed out')
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
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
  }
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
      const contextLimit = MODEL_CONTEXT_LIMITS[model] ?? 200_000

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

      const controller = new AbortController()
      const timeoutHandle =
        config.claudeTimeout > 0
          ? setTimeout(() => controller.abort(), config.claudeTimeout * 1000)
          : null

      let streamLogFile: string | undefined
      if (config.streamLogDir && issueId) {
        mkdirSync(config.streamLogDir, { recursive: true })
        streamLogFile = join(config.streamLogDir, `${issueId}.jsonl`)
      }

      try {
        return await consumeClaudeStream(
          {
            stdout: proc.stdout as ReadableStream<Uint8Array>,
            kill: (signal?: string) => proc.kill(signal as Parameters<typeof proc.kill>[0]),
            exited: proc.exited
          },
          {
            threshold,
            contextLimit,
            streamLogFile,
            isTTY: process.stderr.isTTY ?? false
          },
          controller.signal
        )
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }
      }
    })(),
    toError
  )
}
