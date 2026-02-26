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
  | 'tool_result'
  | 'token_update'
  | 'result'
  | 'error'

export type ActivitySource = 'command' | 'sdk'

export interface ActivityEntry {
  timestamp: number
  source: ActivitySource
  kind: ActivityKind
  issueId?: string
  issueName?: string
  data: Record<string, unknown>
}

/**
 * Converts a raw JSONL SDK message into an {@link ActivityEntry}, or `null` if
 * the message type is not relevant for the activity log.
 *
 * The Claude Agent SDK records complete message objects (not streaming events):
 * - Tool calls: `type === 'assistant'` with `message.content[0].type === 'tool_use'`
 * - Tool results: `type === 'user'` with `message.content[0].type === 'tool_result'`
 * - Token usage: `type === 'assistant'` with `message.usage` (only when no tool_use)
 */
export function parseLogMessage(raw: unknown): ActivityEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const msg = raw as Record<string, unknown>
  const ts = Date.now()

  if (
    msg.type === 'assistant' &&
    typeof msg.message === 'object' &&
    msg.message !== null
  ) {
    const message = msg.message as Record<string, unknown>
    const content = message.content

    // Tool call: assistant message with tool_use content block
    if (Array.isArray(content) && content.length > 0) {
      const block = content[0] as Record<string, unknown>
      if (block.type === 'tool_use' && typeof block.name === 'string') {
        return {
          timestamp: ts,
          source: 'sdk',
          kind: 'tool_call',
          data: {
            tool: block.name,
            toolUseId: typeof block.id === 'string' ? block.id : undefined,
            args:
              typeof block.input === 'object' && block.input !== null
                ? (block.input as Record<string, unknown>)
                : undefined,
          },
        }
      }
    }

    // Token update: assistant message with usage but no tool_use (avoids duplicates
    // from parallel tool calls where each call emits its own assistant message)
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

  // Tool result: user message with tool_result content block
  if (
    msg.type === 'user' &&
    typeof msg.message === 'object' &&
    msg.message !== null
  ) {
    const message = msg.message as Record<string, unknown>
    const content = message.content
    if (Array.isArray(content) && content.length > 0) {
      const block = content[0] as Record<string, unknown>
      if (block.type === 'tool_result') {
        return {
          timestamp: ts,
          source: 'sdk',
          kind: 'tool_result',
          data: {
            toolUseId:
              typeof block.tool_use_id === 'string'
                ? block.tool_use_id
                : undefined,
            content: extractContent(block.content),
            isError: block.is_error === true,
          },
        }
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

function extractContent(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, 500)
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        const item = c as Record<string, unknown>
        return typeof item.text === 'string' ? item.text : ''
      })
      .join('\n')
      .slice(0, 500)
  }
  return ''
}
