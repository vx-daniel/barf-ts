import { describe, it, expect, mock } from 'bun:test'
import { consumeClaudeStream } from '@/core/claude'
import type { ClaudeProc, ConsumeStreamOptions } from '@/core/claude'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a ClaudeProc backed by real ReadableStream JSONL lines. */
function makeProc(opts: { lines?: string[]; exitCode?: number } = {}): ClaudeProc {
  const encoder = new TextEncoder()
  return {
    stdout: new ReadableStream({
      start(controller) {
        for (const line of opts.lines ?? []) {
          controller.enqueue(encoder.encode(line + '\n'))
        }
        controller.close()
      }
    }),
    kill: mock(() => {}),
    exited: new Promise(resolve => queueMicrotask(() => resolve(opts.exitCode ?? 0)))
  }
}

function defaultOpts(overrides: Partial<ConsumeStreamOptions> = {}): ConsumeStreamOptions {
  return {
    threshold: 200_000,
    contextLimit: 200_000,
    ...overrides
  }
}

// ── JSONL fixtures (same format as context.test.ts) ──────────────────────────

const USAGE_1000 = JSON.stringify({
  parent_tool_use_id: null,
  message: { usage: { cache_creation_input_tokens: 800, cache_read_input_tokens: 200 } }
})

const USAGE_2000 = JSON.stringify({
  parent_tool_use_id: null,
  message: { usage: { cache_creation_input_tokens: 1500, cache_read_input_tokens: 500 } }
})

const USAGE_500 = JSON.stringify({
  parent_tool_use_id: null,
  message: { usage: { cache_creation_input_tokens: 300, cache_read_input_tokens: 200 } }
})

const TOOL_READ = JSON.stringify({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name: 'Read' }] }
})

const RATE_LIMIT = JSON.stringify({
  type: 'rate_limit_event',
  rate_limit_info: { status: 'rejected', resetsAt: 1_700_000_000 }
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('consumeClaudeStream', () => {
  it('returns success when stream completes normally', async () => {
    const proc = makeProc({ lines: [USAGE_1000] })
    const result = await consumeClaudeStream(proc, defaultOpts())

    expect(result.outcome).toBe('success')
    expect(result.tokens).toBe(1000)
  })

  it('returns overflow when context threshold is exceeded', async () => {
    const proc = makeProc({ lines: [USAGE_1000] })
    const result = await consumeClaudeStream(proc, defaultOpts({ threshold: 500 }))

    expect(result.outcome).toBe('overflow')
    expect(result.tokens).toBe(1000)
    expect(proc.kill).toHaveBeenCalled()
  })

  it('returns rate_limited when rate limit event is received', async () => {
    const proc = makeProc({ lines: [USAGE_500, RATE_LIMIT] })
    const result = await consumeClaudeStream(proc, defaultOpts())

    expect(result.outcome).toBe('rate_limited')
    expect(result.tokens).toBe(500)
    expect(result.rateLimitResetsAt).toBe(1_700_000_000)
  })

  it('propagates unknown errors from the stream', async () => {
    const proc: ClaudeProc = {
      stdout: new ReadableStream({
        start(controller) {
          controller.error(new Error('unexpected failure'))
        }
      }),
      kill: mock(() => {}),
      exited: new Promise(resolve => queueMicrotask(() => resolve(1)))
    }

    await expect(consumeClaudeStream(proc, defaultOpts())).rejects.toThrow('unexpected failure')
  })

  it('tracks tool events and reports last token count', async () => {
    const proc = makeProc({ lines: [USAGE_500, TOOL_READ, USAGE_1000] })
    const result = await consumeClaudeStream(proc, defaultOpts())

    expect(result.outcome).toBe('success')
    expect(result.tokens).toBe(1000)
  })

  it('returns zero tokens when no usage events', async () => {
    const proc = makeProc({ lines: [] })
    const result = await consumeClaudeStream(proc, defaultOpts())

    expect(result.outcome).toBe('success')
    expect(result.tokens).toBe(0)
  })

  it('writes TTY progress when isTTY is set', async () => {
    let stderrOutput = ''
    const proc = makeProc({ lines: [USAGE_1000, TOOL_READ, USAGE_2000] })
    const result = await consumeClaudeStream(
      proc,
      defaultOpts({
        isTTY: true,
        stderrWrite: (data: string) => {
          stderrOutput += data
        }
      })
    )

    expect(result.outcome).toBe('success')
    expect(stderrOutput).toContain('context:')
    expect(stderrOutput).toContain('Read')
  })

  it('returns error outcome when signal is aborted (timeout)', async () => {
    const proc = makeProc({ lines: [USAGE_500] })
    const result = await consumeClaudeStream(proc, defaultOpts(), AbortSignal.abort())

    expect(result.outcome).toBe('error')
    expect(result.tokens).toBe(500)
    expect(proc.kill).toHaveBeenCalled()
  })
})
