import { join } from 'path'
import { mkdirSync, createWriteStream, type WriteStream } from 'fs'
import { ResultAsync } from 'neverthrow'
import { query, type Query } from '@anthropic-ai/claude-agent-sdk'
import type { Config, DisplayContext } from '@/types'
import type { IterationResult } from '@/types/schema/claude-schema'
import { ContextOverflowError, RateLimitError } from '@/core/context'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

export type { IterationOutcome, IterationResult } from '@/types/schema/claude-schema'

const logger = createLogger('claude')

/** Fallback context-window token limit for models not in `MODEL_CONTEXT_LIMITS`. */
export const DEFAULT_CONTEXT_LIMIT = 200_000

// Context window limits per model (tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-opus-4-6': DEFAULT_CONTEXT_LIMIT,
  'claude-sonnet-4-6': DEFAULT_CONTEXT_LIMIT,
  'claude-haiku-4-5-20251001': DEFAULT_CONTEXT_LIMIT
}

/**
 * Returns the context-window token limit for `model`.
 * Falls back to {@link DEFAULT_CONTEXT_LIMIT} for unregistered models.
 *
 * @param model - Claude model identifier string
 * @returns Token limit for the model
 */
export function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] ?? DEFAULT_CONTEXT_LIMIT
}

/**
 * Registers or overrides the context-window token limit for `model`.
 * Useful in tests and for models added after compile time.
 *
 * @param model - Model identifier string
 * @param limit - Token limit to associate with this model
 */
export function setContextLimit(model: string, limit: number): void {
  MODEL_CONTEXT_LIMITS[model] = limit
}

/**
 * Computes the token threshold at which barf interrupts a Claude session.
 * threshold = floor(contextUsagePercent% × modelLimit)
 *
 * @category Claude Agent
 */
export function getThreshold(model: string, contextUsagePercent: number): number {
  const limit = getContextLimit(model)
  return Math.floor((contextUsagePercent / 100) * limit)
}

/**
 * Iterates an SDK query stream, tracking token usage and tool calls.
 * Exported for direct testing with injected mock `Query` objects.
 *
 * Token counting uses all input tokens: base + cache_creation + cache_read —
 * more accurate than the previous cache-only approach. Only main-context
 * assistant messages (`parent_tool_use_id === null`) count toward the threshold;
 * sub-agent tokens are ignored to prevent premature interruption during tool calls.
 *
 * @param q - Active SDK query to consume.
 * @param threshold - Token count at which to interrupt and return `'overflow'`.
 * @param contextLimit - Model's total context window size, used for TTY progress display.
 * @param streamLogFile - Optional path; each SDK message is appended as a JSON line.
 * @param isTTY - When true, writes a live progress line via `stderrWrite`.
 * @param stderrWrite - Sink for TTY progress output.
 * @param signal - When aborted, `q.interrupt()` is called and outcome is `'error'`.
 * @param displayContext - When provided and `isTTY` is true, renders a sticky header line above the progress line.
 * @returns `IterationResult` with outcome and token count.
 * @category Claude Agent
 */
export async function consumeSDKQuery(
  q: Query,
  threshold: number,
  contextLimit: number,
  streamLogFile: string | undefined,
  isTTY: boolean,
  stderrWrite: (data: string) => void,
  signal: AbortSignal,
  displayContext?: DisplayContext
): Promise<IterationResult> {
  let lastTokens = 0
  let lastTool = ''
  const logStream: WriteStream | null = streamLogFile
    ? createWriteStream(streamLogFile, { flags: 'a' })
    : null

  const onAbort = () => {
    q.interrupt().catch(() => {})
  }
  if (signal.aborted) {
    onAbort()
  } else {
    signal.addEventListener('abort', onAbort, { once: true })
  }

  if (displayContext && isTTY) {
    const rawTitle = displayContext.title
    const title = rawTitle.length > 50 ? rawTitle.slice(0, 47) + '...' : rawTitle
    stderrWrite(
      `▶ ${displayContext.mode}  ${displayContext.issueId}  ${displayContext.state}  ${title}\n`
    )
  }

  try {
    for await (const msg of q) {
      logStream?.write(JSON.stringify(msg) + '\n')

      if (msg.type === 'assistant') {
        // Rate limit reported on the assistant message itself
        if (msg.error === 'rate_limit') {
          throw new RateLimitError(undefined)
        }

        // Token tracking — main context only (ignore sub-agent turns)
        if (msg.parent_tool_use_id === null) {
          const usage = msg.message.usage
          const tokens =
            (usage.input_tokens ?? 0) +
            (usage.cache_creation_input_tokens ?? 0) +
            (usage.cache_read_input_tokens ?? 0)
          if (tokens > lastTokens) {
            lastTokens = tokens
            logger.debug({ tokens, threshold }, 'context update')
            if (isTTY) {
              const pct = Math.round((tokens / contextLimit) * 100)
              const toolPart = lastTool ? `  |  ${lastTool}` : ''
              stderrWrite(
                `\r\x1b[K  context: ${tokens.toLocaleString()} / ${contextLimit.toLocaleString()} (${pct}%)${toolPart}`
              )
            }
            if (tokens >= threshold) {
              await q.interrupt()
              throw new ContextOverflowError(tokens)
            }
          }
        }

        // Tool name from content blocks
        const content = msg.message.content
        if (Array.isArray(content)) {
          const toolBlock = content.find(c => c.type === 'tool_use')
          if (toolBlock && 'name' in toolBlock) {
            lastTool = toolBlock.name as string
            logger.debug({ tool: lastTool }, 'tool call')
          }
        }
      }

      if (msg.type === 'result') {
        if (isTTY) {
          stderrWrite(displayContext ? '\r\x1b[K\x1b[1A\r\x1b[K' : '\r\x1b[K')
        }
        if (msg.subtype === 'success') {
          return { outcome: 'success', tokens: lastTokens }
        }
        // Error subtypes — check errors array for rate limit keywords
        if ('errors' in msg && msg.errors.some((e: string) => /rate.?limit/i.test(e))) {
          throw new RateLimitError(undefined)
        }
        return { outcome: 'error', tokens: lastTokens }
      }
    }

    // Stream ended without a result message
    if (isTTY) {
      stderrWrite(displayContext ? '\r\x1b[K\x1b[1A\r\x1b[K' : '\r\x1b[K')
    }
    if (signal.aborted) {
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
    signal.removeEventListener('abort', onAbort)
    logStream?.end()
  }
}

/**
 * Runs a single Claude agent iteration via the `@anthropic-ai/claude-agent-sdk`.
 * No subprocess is spawned — the SDK manages the Claude Code process internally.
 * The public API is identical to the previous subprocess-based implementation.
 *
 * Key options: `permissionMode: 'bypassPermissions'` (replaces --dangerously-skip-permissions),
 * `settingSources: []` (SDK isolation — no CLAUDE.md loaded; all context from prompt),
 * and `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '100'` (disables Claude Code auto-compact so barf
 * can track context and interrupt at the configured threshold itself).
 *
 * @param prompt - Full prompt text sent as the first user message.
 * @param model - Claude model identifier (e.g. `'claude-sonnet-4-6'`).
 * @param config - Loaded barf configuration (timeout, context percent, stream log dir).
 * @param issueId - When set, each SDK message is appended to `config.streamLogDir/<issueId>.jsonl`.
 * @param displayContext - When set, a sticky header line is shown above the progress line on TTY stderr.
 * @returns `ok(IterationResult)` on success/overflow/rate-limit, `err(Error)` if the SDK throws unexpectedly.
 * @category Claude Agent
 */
export function runClaudeIteration(
  prompt: string,
  model: string,
  config: Config,
  issueId?: string,
  displayContext?: DisplayContext
): ResultAsync<IterationResult, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<IterationResult> => {
      const threshold = getThreshold(model, config.contextUsagePercent)
      const contextLimit = getContextLimit(model)

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

      const q = query({
        prompt,
        options: {
          model,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          settingSources: [],
          abortController: controller,
          cwd: process.cwd(),
          env: { ...process.env, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '100' }
        }
      })

      try {
        return await consumeSDKQuery(
          q,
          threshold,
          contextLimit,
          streamLogFile,
          process.stderr.isTTY ?? false,
          (data: string) => process.stderr.write(data),
          controller.signal,
          displayContext
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
