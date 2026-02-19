import { z } from 'zod'
import { createWriteStream, type WriteStream } from 'fs'
import type { ClaudeEvent } from '@/types'

export class ContextOverflowError extends Error {
  constructor(public readonly tokens: number) {
    super(`Context threshold exceeded: ${tokens} tokens`)
    this.name = 'ContextOverflowError'
  }
}

export class RateLimitError extends Error {
  constructor(public readonly resetsAt?: number) {
    const resetStr = resetsAt ? new Date(resetsAt * 1000).toLocaleTimeString() : 'soon'
    super(`Rate limited until ${resetStr}`)
    this.name = 'RateLimitError'
  }
}

// Internal schemas for validating Claude --output-format stream-json event shapes.
// Not exported — these model Claude CLI internals, not the public ClaudeEvent contract.
const RateLimitInfoSchema = z.object({
  rate_limit_info: z
    .object({ status: z.string().optional(), resetsAt: z.number().optional() })
    .optional()
})

const UsageMessageSchema = z.object({
  usage: z
    .object({
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional()
    })
    .optional()
})

const AssistantContentSchema = z.object({
  content: z.array(z.object({ type: z.string(), name: z.string().optional() })).optional()
})

/**
 * Async generator that parses Claude's --output-format stream-json stdout.
 * Yields {@link ClaudeEvent} (usage | tool). Kills proc and throws on overflow or rate limit.
 *
 * Token tracking: only from main context (parent_tool_use_id === null).
 * Sub-agent tokens are ignored to prevent premature interruption during tool calls.
 *
 * @param proc - The Claude subprocess; must expose a readable `stdout` and a `kill` method.
 * @param threshold - Token count at which to kill the process and throw {@link ContextOverflowError}.
 * @param streamLogFile - Optional file path; each raw JSONL line is appended for debugging.
 * @returns Async generator yielding {@link ClaudeEvent} objects; throws {@link ContextOverflowError}
 *   on threshold breach or {@link RateLimitError} on API rate limiting.
 */
export async function* parseClaudeStream(
  proc: { stdout: ReadableStream<Uint8Array>; kill: (signal?: string) => void },
  threshold: number,
  streamLogFile?: string
): AsyncGenerator<ClaudeEvent> {
  const reader = proc.stdout.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let maxTokens = 0
  const logStream: WriteStream | null = streamLogFile
    ? createWriteStream(streamLogFile, { flags: 'a' })
    : null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })

      // Process all complete lines (up to last newline)
      const nl = buffer.lastIndexOf('\n')
      if (nl === -1) {
        continue
      }
      const lines = buffer.slice(0, nl + 1).split('\n')
      buffer = buffer.slice(nl + 1)

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          continue
        }

        logStream?.write(trimmed + '\n')

        let obj: Record<string, unknown>
        try {
          obj = JSON.parse(trimmed) as Record<string, unknown>
        } catch {
          continue // skip non-JSON lines (e.g. stderr mixed in)
        }

        // Rate limit detection
        if (obj['type'] === 'rate_limit_event') {
          const parsed = RateLimitInfoSchema.safeParse(obj)
          const info = parsed.success ? parsed.data.rate_limit_info : undefined
          if (info?.status === 'rejected') {
            proc.kill()
            throw new RateLimitError(info.resetsAt)
          }
        }

        // Token usage — main context only (parent_tool_use_id must be null)
        if (obj['parent_tool_use_id'] === null && obj['message']) {
          const parsed = UsageMessageSchema.safeParse(obj['message'])
          const usage = parsed.success ? parsed.data.usage : undefined
          if (usage) {
            const tokens =
              (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
            if (tokens > maxTokens) {
              maxTokens = tokens
              yield { type: 'usage', tokens }
              if (tokens >= threshold) {
                proc.kill('SIGTERM')
                throw new ContextOverflowError(tokens)
              }
            }
          }
        }

        // Tool name from assistant messages
        if (obj['type'] === 'assistant' && obj['message']) {
          const parsed = AssistantContentSchema.safeParse(obj['message'])
          const content = parsed.success ? parsed.data.content : undefined
          const tool = content?.find(c => c.type === 'tool_use' && c.name)
          if (tool?.name) {
            yield { type: 'tool', name: tool.name }
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ignore double-release */
    }
    logStream?.end()
  }
}

/**
 * Injects barf template variables into a prompt string.
 * Simple string replacement — no eval, no shell, injection-safe.
 *
 * @param template - Raw prompt template containing `${BARF_*}` or `$BARF_*` placeholders.
 * @param vars - Substitution values for each supported placeholder.
 * @returns The template string with all recognized placeholders replaced by their string values.
 */
export function injectPromptVars(
  template: string,
  vars: {
    issueId: string
    issueFile: string
    mode: string
    iteration: number
    issuesDir: string
    planDir: string
  }
): string {
  return template
    .replace(/\$\{?BARF_ISSUE_ID\}?/g, vars.issueId)
    .replace(/\$\{?BARF_ISSUE_FILE\}?/g, vars.issueFile)
    .replace(/\$\{?BARF_MODE\}?/g, vars.mode)
    .replace(/\$\{?BARF_ITERATION\}?/g, String(vars.iteration))
    .replace(/\$\{?ISSUES_DIR\}?/g, vars.issuesDir)
    .replace(/\$\{?PLAN_DIR\}?/g, vars.planDir)
}
