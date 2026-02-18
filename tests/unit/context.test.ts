import { describe, it, expect, mock } from 'bun:test'
import {
  parseClaudeStream,
  injectPromptVars,
  ContextOverflowError,
  RateLimitError
} from '@/core/context'

// Helper: create a mock subprocess with controlled stdout lines
function makeProc(lines: string[]): {
  stdout: ReadableStream<Uint8Array>
  kill: ReturnType<typeof mock>
} {
  const encoder = new TextEncoder()
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'))
      }
      controller.close()
    }
  })
  return { stdout: readable, kill: mock(() => {}) }
}

// Sample stream-json lines
const MAIN_USAGE = JSON.stringify({
  parent_tool_use_id: null,
  message: { usage: { cache_creation_input_tokens: 1000, cache_read_input_tokens: 500 } }
})

const SUB_USAGE = JSON.stringify({
  parent_tool_use_id: 'some-tool-id',
  message: { usage: { cache_creation_input_tokens: 9999, cache_read_input_tokens: 0 } }
})

const TOOL_LINE = JSON.stringify({
  type: 'assistant',
  message: {
    content: [
      { type: 'tool_use', name: 'Read' },
      { type: 'text', text: 'hi' }
    ]
  }
})

const RATE_LIMIT = JSON.stringify({
  type: 'rate_limit_event',
  rate_limit_info: { status: 'rejected', resetsAt: 1_700_000_000 }
})

describe('parseClaudeStream', () => {
  it('yields usage events from main context (parent_tool_use_id=null)', async () => {
    const proc = makeProc([MAIN_USAGE])
    const events = []
    for await (const event of parseClaudeStream(proc, 100_000)) {
      events.push(event)
    }
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'usage', tokens: 1500 })
  })

  it('ignores usage from sub-agent context (parent_tool_use_id != null)', async () => {
    const proc = makeProc([SUB_USAGE])
    const events = []
    for await (const event of parseClaudeStream(proc, 100_000)) {
      events.push(event)
    }
    expect(events).toHaveLength(0)
  })

  it('yields tool events from assistant messages', async () => {
    const proc = makeProc([TOOL_LINE])
    const events = []
    for await (const event of parseClaudeStream(proc, 100_000)) {
      events.push(event)
    }
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'tool', name: 'Read' })
  })

  it('kills proc and throws ContextOverflowError when threshold exceeded', async () => {
    const proc = makeProc([MAIN_USAGE]) // 1500 tokens
    let threw: unknown
    try {
      for await (const _ of parseClaudeStream(proc, 1000)) {
        /* consume */
      }
    } catch (e) {
      threw = e
    }
    expect(threw).toBeInstanceOf(ContextOverflowError)
    expect((threw as ContextOverflowError).tokens).toBe(1500)
    expect(proc.kill).toHaveBeenCalled()
  })

  it('throws RateLimitError on rate_limit_event with status=rejected', async () => {
    const proc = makeProc([RATE_LIMIT])
    let threw: unknown
    try {
      for await (const _ of parseClaudeStream(proc, 100_000)) {
        /* consume */
      }
    } catch (e) {
      threw = e
    }
    expect(threw).toBeInstanceOf(RateLimitError)
    expect(proc.kill).toHaveBeenCalled()
  })

  it('skips non-JSON lines without throwing', async () => {
    const proc = makeProc(['not json at all', MAIN_USAGE, 'also bad'])
    const events = []
    for await (const event of parseClaudeStream(proc, 100_000)) {
      events.push(event)
    }
    expect(events).toHaveLength(1)
  })

  it('does not yield duplicate usage for same token count', async () => {
    const proc = makeProc([MAIN_USAGE, MAIN_USAGE]) // same count twice
    const events = []
    for await (const event of parseClaudeStream(proc, 100_000)) {
      events.push(event)
    }
    expect(events).toHaveLength(1) // second is ignored (not > maxTokens)
  })
})

describe('injectPromptVars', () => {
  const vars = {
    issueId: '001',
    issueFile: 'issues/001.md.working',
    mode: 'build',
    iteration: 2,
    issuesDir: 'issues',
    planDir: 'plans'
  }

  it('replaces $BARF_ISSUE_ID', () => {
    expect(injectPromptVars('id: $BARF_ISSUE_ID', vars)).toBe('id: 001')
  })

  // eslint-disable-next-line no-template-curly-in-string
  it('replaces ${BARF_ISSUE_ID} (braced form)', () => {
    // eslint-disable-next-line no-template-curly-in-string
    expect(injectPromptVars('id: ${BARF_ISSUE_ID}', vars)).toBe('id: 001')
  })

  it('replaces all six variables', () => {
    const t = '$BARF_ISSUE_ID $BARF_ISSUE_FILE $BARF_MODE $BARF_ITERATION $ISSUES_DIR $PLAN_DIR'
    expect(injectPromptVars(t, vars)).toBe('001 issues/001.md.working build 2 issues plans')
  })

  it('replaces multiple occurrences of the same variable', () => {
    expect(injectPromptVars('$BARF_ISSUE_ID $BARF_ISSUE_ID', vars)).toBe('001 001')
  })
})
