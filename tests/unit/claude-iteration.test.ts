import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ConfigSchema } from '@/types'
import type { Config } from '@/types'

const defaultConfig = (): Config => ConfigSchema.parse({})

// We need to mock bun's spawn and parseClaudeStream. Since runClaudeIteration
// uses `spawn` from 'bun' and `parseClaudeStream` from '@/core/context',
// we mock both modules before importing the module under test.

// Controllable state for each test
let mockStreamEvents: Array<{ type: string; tokens?: number; name?: string }> = []
let mockStreamThrow: Error | null = null
let mockStreamDelayMs = 0
let mockExitCode = 0
let mockKillCalled = false

// Mock parseClaudeStream as an async generator
mock.module('@/core/context', () => {
  const { ContextOverflowError, RateLimitError } = require('@/core/context')

  return {
    ContextOverflowError,
    RateLimitError,
    parseClaudeStream: async function* () {
      if (mockStreamDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, mockStreamDelayMs))
      }
      for (const event of mockStreamEvents) {
        yield event
      }
      if (mockStreamThrow) {
        throw mockStreamThrow
      }
    }
  }
})

// Mock bun's spawn to avoid actually running 'claude'.
// IMPORTANT: Do NOT require('bun') inside this factory — it creates a circular
// reference that causes non-deterministic hangs. claude.ts only imports `spawn`,
// so that's all we need to provide.
mock.module('bun', () => ({
  spawn: () => ({
    stdout: new ReadableStream({
      start(controller: ReadableStreamDefaultController) {
        controller.close()
      }
    }),
    stderr: new ReadableStream({
      start(controller: ReadableStreamDefaultController) {
        controller.close()
      }
    }),
    kill: () => {
      mockKillCalled = true
    },
    exited: new Promise(resolve => queueMicrotask(() => resolve(mockExitCode)))
  })
}))

import { runClaudeIteration, getThreshold } from '@/core/claude'
import { ContextOverflowError, RateLimitError } from '@/core/context'

describe('runClaudeIteration', () => {
  beforeEach(() => {
    mockStreamEvents = []
    mockStreamThrow = null
    mockStreamDelayMs = 0
    mockExitCode = 0
    mockKillCalled = false
  })

  it('returns success when stream completes normally', async () => {
    mockStreamEvents = [{ type: 'usage', tokens: 1000 }]
    const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', defaultConfig())

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().outcome).toBe('success')
    expect(result._unsafeUnwrap().tokens).toBe(1000)
  })

  it('returns overflow when ContextOverflowError is thrown', async () => {
    mockStreamThrow = new ContextOverflowError(150_000)
    const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', defaultConfig())

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().outcome).toBe('overflow')
    expect(result._unsafeUnwrap().tokens).toBe(150_000)
  })

  it('returns rate_limited when RateLimitError is thrown', async () => {
    mockStreamThrow = new RateLimitError(1_700_000_000)
    mockStreamEvents = [{ type: 'usage', tokens: 500 }]
    const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', defaultConfig())

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().outcome).toBe('rate_limited')
    expect(result._unsafeUnwrap().rateLimitResetsAt).toBe(1_700_000_000)
  })

  it('propagates unknown errors', async () => {
    mockStreamThrow = new Error('unexpected failure')
    const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', defaultConfig())

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('unexpected failure')
  })

  it('tracks tool events', async () => {
    mockStreamEvents = [
      { type: 'usage', tokens: 500 },
      { type: 'tool', name: 'Read' },
      { type: 'usage', tokens: 1000 }
    ]
    const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', defaultConfig())

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().tokens).toBe(1000)
  })

  it('returns zero tokens when no usage events', async () => {
    mockStreamEvents = []
    const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', defaultConfig())

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().tokens).toBe(0)
  })

  it('creates stream log directory when streamLogDir is configured', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'barf-claude-log-'))
    const streamLogDir = join(tmpDir, 'streams')
    const config = { ...defaultConfig(), streamLogDir }
    mockStreamEvents = [{ type: 'usage', tokens: 500 }]

    const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', config, 'issue-001')

    expect(result.isOk()).toBe(true)
    expect(existsSync(streamLogDir)).toBe(true)
  })

  it('writes TTY progress when stderr is a TTY', async () => {
    const origIsTTY = process.stderr.isTTY
    const origWrite = process.stderr.write
    let stderrOutput = ''
    process.stderr.isTTY = true as any
    process.stderr.write = ((data: any) => {
      stderrOutput += String(data)
      return true
    }) as any

    mockStreamEvents = [
      { type: 'usage', tokens: 1000 },
      { type: 'tool', name: 'Read' },
      { type: 'usage', tokens: 2000 }
    ]

    try {
      const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', defaultConfig())
      expect(result.isOk()).toBe(true)
      expect(stderrOutput).toContain('context:')
      expect(stderrOutput).toContain('Read')
    } finally {
      process.stderr.isTTY = origIsTTY as any
      process.stderr.write = origWrite
    }
  })

  it('returns error outcome when timed out', async () => {
    mockStreamDelayMs = 200
    mockStreamEvents = [{ type: 'usage', tokens: 300 }]
    const config = { ...defaultConfig(), claudeTimeout: 0.05 } // 50ms

    const result = await runClaudeIteration('prompt', 'claude-sonnet-4-6', config)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().outcome).toBe('error')
  })
})
