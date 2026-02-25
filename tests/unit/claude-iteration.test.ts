import { describe, it, expect, mock } from 'bun:test'
import { consumeSDKQuery } from '@/core/claude'
import type { Query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a mock Query (AsyncGenerator + interrupt()) from a list of messages.
 * When interrupt() is called, the generator exits after the current yield point.
 */
function makeQuery(messages: SDKMessage[]): {
  q: Query
  interrupt: ReturnType<typeof mock>
} {
  let interrupted = false
  const interrupt = mock(async () => {
    interrupted = true
    return new Promise<void>((r) => queueMicrotask(r))
  })

  async function* gen() {
    for (const msg of messages) {
      if (interrupted) return
      yield msg
    }
  }

  const q = gen() as unknown as Query
  ;(q as unknown as Record<string, unknown>).interrupt = interrupt
  return { q, interrupt }
}

/**
 * Builds a mock Query that waits until interrupt() is called before finishing.
 * Simulates a long-running query that gets aborted.
 */
function makeBlockingQuery(): { q: Query; interrupt: ReturnType<typeof mock> } {
  let resolveBlock: () => void = () => {}
  const blockUntilInterrupt = new Promise<void>((r) => {
    resolveBlock = r
  })
  const interrupt = mock(async () => {
    resolveBlock()
    return new Promise<void>((r) => queueMicrotask(r))
  })

  async function* gen() {
    await blockUntilInterrupt
    // Interrupted — yield nothing
  }

  const q = gen() as unknown as Query
  ;(q as unknown as Record<string, unknown>).interrupt = interrupt
  return { q, interrupt }
}

function defaultOpts() {
  return {
    threshold: 200_000,
    contextLimit: 200_000,
    streamLogFile: undefined,
    isTTY: false,
    stderrWrite: (_data: string) => {},
  }
}

// ── SDKMessage fixtures ───────────────────────────────────────────────────────

function makeAssistantMsg(
  inputTokens: number,
  cacheCreate = 0,
  cacheRead = 0,
): SDKMessage {
  return {
    type: 'assistant',
    parent_tool_use_id: null,
    message: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-6',
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: 0,
        cache_creation_input_tokens: cacheCreate,
        cache_read_input_tokens: cacheRead,
      },
    },
    uuid: '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`,
    session_id: 'test',
  } as SDKMessage
}

function makeAssistantToolMsg(toolName: string): SDKMessage {
  return {
    type: 'assistant',
    parent_tool_use_id: null,
    message: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tu_1', name: toolName, input: {} }],
      model: 'claude-sonnet-4-6',
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
    uuid: '00000000-0000-0000-0000-000000000002' as `${string}-${string}-${string}-${string}-${string}`,
    session_id: 'test',
  } as SDKMessage
}

function makeAssistantRateLimitMsg(): SDKMessage {
  return {
    type: 'assistant',
    parent_tool_use_id: null,
    error: 'rate_limit',
    message: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-6',
      stop_reason: null,
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
    uuid: '00000000-0000-0000-0000-000000000003' as `${string}-${string}-${string}-${string}-${string}`,
    session_id: 'test',
  } as SDKMessage
}

function makeResultSuccess(): SDKMessage {
  return {
    type: 'result',
    subtype: 'success',
    duration_ms: 100,
    duration_api_ms: 90,
    is_error: false,
    num_turns: 1,
    result: 'done',
    stop_reason: 'end_turn',
    total_cost_usd: 0.001,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    modelUsage: {},
    permission_denials: [],
    uuid: '00000000-0000-0000-0000-000000000004' as `${string}-${string}-${string}-${string}-${string}`,
    session_id: 'test',
  } as SDKMessage
}

function makeResultError(errors: string[] = []): SDKMessage {
  return {
    type: 'result',
    subtype: 'error_during_execution',
    duration_ms: 100,
    duration_api_ms: 90,
    is_error: true,
    num_turns: 1,
    stop_reason: null,
    total_cost_usd: 0,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    modelUsage: {},
    permission_denials: [],
    errors,
    uuid: '00000000-0000-0000-0000-000000000005' as `${string}-${string}-${string}-${string}-${string}`,
    session_id: 'test',
  } as SDKMessage
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('consumeSDKQuery', () => {
  it('returns success when stream completes with result message', async () => {
    const { q } = makeQuery([
      makeAssistantMsg(800, 100, 100),
      makeResultSuccess(),
    ])
    const opts = defaultOpts()

    const result = await consumeSDKQuery(
      q,
      opts.threshold,
      opts.contextLimit,
      opts.streamLogFile,
      opts.isTTY,
      opts.stderrWrite,
      new AbortController().signal,
    )

    expect(result.outcome).toBe('success')
    expect(result.tokens).toBe(1000) // 800 + 100 + 100
  })

  it('counts input_tokens + cache_creation + cache_read for total token count', async () => {
    const { q } = makeQuery([
      makeAssistantMsg(500, 200, 300),
      makeResultSuccess(),
    ])
    const opts = defaultOpts()

    const result = await consumeSDKQuery(
      q,
      opts.threshold,
      opts.contextLimit,
      opts.streamLogFile,
      opts.isTTY,
      opts.stderrWrite,
      new AbortController().signal,
    )

    expect(result.tokens).toBe(1000) // 500 + 200 + 300
  })

  it('returns overflow when context threshold is exceeded', async () => {
    const { q, interrupt } = makeQuery([makeAssistantMsg(800, 100, 100)]) // 1000 tokens

    const result = await consumeSDKQuery(
      q,
      500, // threshold: 500
      200_000,
      undefined,
      false,
      () => {},
      new AbortController().signal,
    )

    expect(result.outcome).toBe('overflow')
    expect(result.tokens).toBe(1000)
    expect(interrupt).toHaveBeenCalled()
  })

  it('returns rate_limited when assistant message has rate_limit error', async () => {
    const { q } = makeQuery([
      makeAssistantMsg(100),
      makeAssistantRateLimitMsg(),
    ])
    const opts = defaultOpts()

    const result = await consumeSDKQuery(
      q,
      opts.threshold,
      opts.contextLimit,
      opts.streamLogFile,
      opts.isTTY,
      opts.stderrWrite,
      new AbortController().signal,
    )

    expect(result.outcome).toBe('rate_limited')
    expect(result.tokens).toBe(100)
  })

  it('returns rate_limited when result error message contains rate limit keyword', async () => {
    const { q } = makeQuery([
      makeAssistantMsg(100),
      makeResultError(['rate_limit exceeded']),
    ])
    const opts = defaultOpts()

    const result = await consumeSDKQuery(
      q,
      opts.threshold,
      opts.contextLimit,
      opts.streamLogFile,
      opts.isTTY,
      opts.stderrWrite,
      new AbortController().signal,
    )

    expect(result.outcome).toBe('rate_limited')
    expect(result.tokens).toBe(100)
  })

  it('returns error when result message has non-rate-limit error', async () => {
    const { q } = makeQuery([
      makeAssistantMsg(100),
      makeResultError(['some other error']),
    ])
    const opts = defaultOpts()

    const result = await consumeSDKQuery(
      q,
      opts.threshold,
      opts.contextLimit,
      opts.streamLogFile,
      opts.isTTY,
      opts.stderrWrite,
      new AbortController().signal,
    )

    expect(result.outcome).toBe('error')
    expect(result.tokens).toBe(100)
  })

  it('returns zero tokens when no assistant messages', async () => {
    const { q } = makeQuery([makeResultSuccess()])
    const opts = defaultOpts()

    const result = await consumeSDKQuery(
      q,
      opts.threshold,
      opts.contextLimit,
      opts.streamLogFile,
      opts.isTTY,
      opts.stderrWrite,
      new AbortController().signal,
    )

    expect(result.outcome).toBe('success')
    expect(result.tokens).toBe(0)
  })

  it('tracks tool events and reports last token count', async () => {
    const { q } = makeQuery([
      makeAssistantMsg(500),
      makeAssistantToolMsg('Read'),
      makeAssistantMsg(1000),
      makeResultSuccess(),
    ])
    const opts = defaultOpts()

    const result = await consumeSDKQuery(
      q,
      opts.threshold,
      opts.contextLimit,
      opts.streamLogFile,
      opts.isTTY,
      opts.stderrWrite,
      new AbortController().signal,
    )

    expect(result.outcome).toBe('success')
    expect(result.tokens).toBe(1000)
  })

  it('returns error outcome when signal is pre-aborted', async () => {
    const { q, interrupt } = makeBlockingQuery()
    const opts = defaultOpts()

    const result = await consumeSDKQuery(
      q,
      opts.threshold,
      opts.contextLimit,
      opts.streamLogFile,
      opts.isTTY,
      opts.stderrWrite,
      AbortSignal.abort(),
    )

    expect(result.outcome).toBe('error')
    expect(interrupt).toHaveBeenCalled()
  })

  it('writes TTY progress with token count and tool name', async () => {
    let stderrOutput = ''
    const { q } = makeQuery([
      makeAssistantMsg(1000),
      makeAssistantToolMsg('Read'),
      makeAssistantMsg(2000),
      makeResultSuccess(),
    ])

    const result = await consumeSDKQuery(
      q,
      200_000,
      200_000,
      undefined,
      true,
      (data: string) => {
        stderrOutput += data
      },
      new AbortController().signal,
    )

    expect(result.outcome).toBe('success')
    expect(stderrOutput).toContain('context:')
    expect(stderrOutput).toContain('Read')
  })

  it('ignores token counts from sub-agent context (parent_tool_use_id not null)', async () => {
    const subAgentMsg: SDKMessage = {
      type: 'assistant',
      parent_tool_use_id: 'some-tool-id',
      message: {
        id: 'msg_sub',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'claude-sonnet-4-6',
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 99_000,
          output_tokens: 0,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
      uuid: '00000000-0000-0000-0000-000000000006' as `${string}-${string}-${string}-${string}-${string}`,
      session_id: 'test',
    } as SDKMessage

    const { q } = makeQuery([
      subAgentMsg,
      makeAssistantMsg(100),
      makeResultSuccess(),
    ])

    const result = await consumeSDKQuery(
      q,
      200_000,
      200_000,
      undefined,
      false,
      () => {},
      new AbortController().signal,
    )

    expect(result.outcome).toBe('success')
    expect(result.tokens).toBe(100) // only main-context tokens counted
  })
})
