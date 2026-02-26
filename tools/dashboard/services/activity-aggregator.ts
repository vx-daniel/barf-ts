/**
 * Merges raw SDK JSONL messages into structured ActivityEntry records.
 *
 * Extracts only the fields the dashboard cares about: tool names, token deltas,
 * result summaries. Raw messages are discarded after extraction.
 */

export type ActivityKind =
  | 'stdout'
  | 'stderr'
  | 'tool_call'
  | 'token_update'
  | 'result'
  | 'error'

export type ActivitySource = 'command' | 'sdk'

export interface ActivityEntry {
  timestamp: number
  source: ActivitySource
  kind: ActivityKind
  data: Record<string, unknown>
}

/**
 * Converts a raw JSONL SDK message into an {@link ActivityEntry}, or `null` if
 * the message type is not relevant for the activity log.
 */
export function parseLogMessage(raw: unknown): ActivityEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const msg = raw as Record<string, unknown>
  const ts = Date.now()

  if (msg.type === 'assistant' && typeof msg.message === 'object' && msg.message !== null) {
    const message = msg.message as Record<string, unknown>
    const usage = message.usage as Record<string, number> | undefined
    if (usage) {
      return {
        timestamp: ts,
        source: 'sdk',
        kind: 'token_update',
        data: {
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
        },
      }
    }
  }

  if (msg.type === 'tool_use' || (msg.type === 'content_block_start' && isToolUse(msg))) {
    const name = extractToolName(msg)
    if (name) {
      return {
        timestamp: ts,
        source: 'sdk',
        kind: 'tool_call',
        data: { tool: name },
      }
    }
  }

  if (msg.type === 'result') {
    return {
      timestamp: ts,
      source: 'sdk',
      kind: 'result',
      data: { result: msg.subtype ?? 'unknown' },
    }
  }

  if (msg.type === 'error') {
    return {
      timestamp: ts,
      source: 'sdk',
      kind: 'error',
      data: { error: msg.error ?? 'unknown' },
    }
  }

  return null
}

function isToolUse(msg: Record<string, unknown>): boolean {
  const block = msg.content_block as Record<string, unknown> | undefined
  return block?.type === 'tool_use'
}

function extractToolName(msg: Record<string, unknown>): string | null {
  if (typeof msg.name === 'string') return msg.name
  const block = msg.content_block as Record<string, unknown> | undefined
  if (typeof block?.name === 'string') return block.name
  return null
}
