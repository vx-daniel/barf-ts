import { describe, it, expect, mock, beforeEach } from 'bun:test'

const mockState = {
  stdout: '{"pass":true}',
  stderr: '',
  status: 0
}

mock.module('@/utils/execFileNoThrow', () => ({
  execFileNoThrow: async (_file: string, _args: string[]) => ({
    stdout: mockState.stdout,
    stderr: mockState.stderr,
    status: mockState.status
  })
}))

import { CodexAuditProvider } from '@/providers/codex'
import { defaultConfig } from '@tests/fixtures/provider'

describe('CodexAuditProvider.describe', () => {
  it('returns codex name and empty requiredConfigKeys', () => {
    const provider = new CodexAuditProvider(defaultConfig())
    const info = provider.describe()
    expect(info.name).toBe('codex')
    expect(info.displayName).toBe('OpenAI Codex (CLI)')
    expect(info.requiredConfigKeys).toHaveLength(0)
    expect(info.supportedModels).toContain('codex')
  })
})

describe('CodexAuditProvider.isConfigured', () => {
  it('always returns true regardless of config', () => {
    const provider = new CodexAuditProvider(defaultConfig())
    expect(provider.isConfigured(defaultConfig())).toBe(true)
  })
})

describe('CodexAuditProvider.chat', () => {
  beforeEach(() => {
    mockState.stdout = '{"pass":true}'
    mockState.stderr = ''
    mockState.status = 0
  })

  it('returns ChatResult with stdout as content on success', async () => {
    const provider = new CodexAuditProvider(defaultConfig())
    const result = await provider.chat('test prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('{"pass":true}')
      expect(result.value.promptTokens).toBe(0)
      expect(result.value.completionTokens).toBe(0)
      expect(result.value.totalTokens).toBe(0)
    }
  })

  it('returns err when codex exits with non-zero status', async () => {
    mockState.status = 1
    mockState.stderr = 'authentication required'
    const provider = new CodexAuditProvider(defaultConfig())
    const result = await provider.chat('prompt')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('status 1')
      expect(result.error.message).toContain('authentication required')
    }
  })

  it('trims whitespace from stdout content', async () => {
    mockState.stdout = '  hello world  \n'
    const provider = new CodexAuditProvider(defaultConfig())
    const result = await provider.chat('prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.content).toBe('hello world')
  })
})

describe('CodexAuditProvider.ping', () => {
  beforeEach(() => {
    mockState.stdout = 'pong'
    mockState.stderr = ''
    mockState.status = 0
  })

  it('returns latencyMs and model on success', async () => {
    const provider = new CodexAuditProvider(defaultConfig())
    const result = await provider.ping()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.model).toBe('codex')
      expect(result.value.latencyMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns err when codex exits with non-zero status', async () => {
    mockState.status = 127
    mockState.stderr = 'codex: command not found'
    const provider = new CodexAuditProvider(defaultConfig())
    const result = await provider.ping()
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('exit 127')
      expect(result.error.message).toContain('codex: command not found')
    }
  })
})
