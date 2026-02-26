/**
 * SDK stream consumer — iterates Claude agent SDK messages and tracks tokens.
 *
 * This is the core of barf's Claude integration. It consumes the async
 * message stream from the Claude agent SDK, tracking:
 * - Cumulative input tokens (for context overflow detection)
 * - Output tokens (for stats)
 * - Tool invocations (for TTY progress display)
 * - Rate limit errors (from assistant messages and result messages)
 *
 * Only main-context assistant messages (`parent_tool_use_id === null`) count
 * toward the threshold — sub-agent tokens are ignored to prevent premature
 * interruption during tool calls.
 *
 * @module claude/stream
 */
import type { Query } from '@anthropic-ai/claude-agent-sdk'
import { createWriteStream, type WriteStream } from 'fs'
import { ContextOverflowError, RateLimitError } from '@/core/context'
import type { DisplayContext } from '@/types'
import type { IterationResult } from '@/types/schema/claude-schema'
import { createLogger } from '@/utils/logger'
import { clearProgress, writeHeader, writeProgress } from './display'

const logger = createLogger('claude')

/**
 * Iterates an SDK query stream, tracking token usage and tool calls.
 *
 * Exported for direct testing with injected mock `Query` objects. The function
 * handles three concerns:
 * 1. **Token tracking** — counts input tokens from main-context messages
 * 2. **Overflow detection** — interrupts when tokens exceed the threshold
 * 3. **Error classification** — maps SDK errors to domain errors
 *
 * TTY display (header, progress, cleanup) is delegated to `display.ts`.
 * Stream logging (JSONL) is handled inline via an optional write stream.
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
  displayContext?: DisplayContext,
): Promise<IterationResult> {
  let lastTokens = 0
  let lastOutputTokens = 0
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
    writeHeader(displayContext, stderrWrite)
  }

  try {
    for await (const msg of q) {
      logStream?.write(`${JSON.stringify(msg)}\n`)

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
          const outTokens = (usage.output_tokens as number | undefined) ?? 0
          if (outTokens > lastOutputTokens) {
            lastOutputTokens = outTokens
          }
          if (tokens > lastTokens) {
            lastTokens = tokens
            logger.debug({ tokens, threshold }, 'context update')
            if (isTTY) {
              writeProgress(tokens, contextLimit, lastTool, stderrWrite)
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
          const toolBlock = content.find((c) => c.type === 'tool_use')
          if (toolBlock && 'name' in toolBlock) {
            lastTool = toolBlock.name as string
            logger.debug({ tool: lastTool }, 'tool call')
          }
        }
      }

      if (msg.type === 'result') {
        if (isTTY) {
          clearProgress(!!displayContext, stderrWrite)
        }
        if (msg.subtype === 'success') {
          return {
            outcome: 'success',
            tokens: lastTokens,
            outputTokens: lastOutputTokens,
          }
        }
        // Error subtypes — check errors array for rate limit keywords
        if (
          'errors' in msg &&
          msg.errors.some((e: string) => /rate.?limit/i.test(e))
        ) {
          throw new RateLimitError(undefined)
        }
        return {
          outcome: 'error',
          tokens: lastTokens,
          outputTokens: lastOutputTokens,
        }
      }
    }

    // Stream ended without a result message
    if (isTTY) {
      clearProgress(!!displayContext, stderrWrite)
    }
    if (signal.aborted) {
      logger.warn({ threshold }, 'claude timed out')
      return {
        outcome: 'error',
        tokens: lastTokens,
        outputTokens: lastOutputTokens,
      }
    }
    return {
      outcome: 'success',
      tokens: lastTokens,
      outputTokens: lastOutputTokens,
    }
  } catch (e) {
    if (e instanceof ContextOverflowError) {
      return {
        outcome: 'overflow',
        tokens: e.tokens,
        outputTokens: lastOutputTokens,
      }
    }
    if (e instanceof RateLimitError) {
      return {
        outcome: 'rate_limited',
        tokens: lastTokens,
        outputTokens: lastOutputTokens,
        rateLimitResetsAt: e.resetsAt,
      }
    }
    throw e
  } finally {
    signal.removeEventListener('abort', onAbort)
    logStream?.end()
  }
}
