import { describe, it, expect, mock, beforeEach } from 'bun:test'

const mockState = {
  error: null as Error | null,
  response: {
    content: [{ type: 'text', text: '{"pass":true}' }],
    usage: { input_tokens: 20, output_tokens: 10 }
  } as unknown
}

mock.module('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: async (_opts: unknown) => {
        if (mockState.error) throw mockState.error
        return mockState.response
      }
    }
    constructor(_opts: unknown) {}
  }
}))

import { ClaudeAuditProvider } from '@/providers/claude'
import { defaultConfig } from '@tests/fixtures/provider'

const claudeConfig = () => ({
  ...defaultConfig(),
  anthropicApiKey: 'sk-ant-test',
  claudeAuditModel: 'claude-sonnet-4-6'
})

describe('ClaudeAuditProvider.describe', () => {
  it('returns claude name and requiredConfigKeys', () => {
    const provider = new ClaudeAuditProvider(claudeConfig())
    const info = provider.describe()
    expect(info.name).toBe('claude')
    expect(info.requiredConfigKeys).toContain('anthropicApiKey')
  })
})

describe('ClaudeAuditProvider.isConfigured', () => {
  it('returns true when anthropicApiKey is set', () => {
    const provider = new ClaudeAuditProvider(claudeConfig())
    expect(provider.isConfigured(claudeConfig())).toBe(true)
  })

  it('returns false when anthropicApiKey is empty', () => {
    const cfg = { ...claudeConfig(), anthropicApiKey: '' }
    const provider = new ClaudeAuditProvider(cfg)
    expect(provider.isConfigured(cfg)).toBe(false)
  })
})

describe('ClaudeAuditProvider.chat', () => {
  beforeEach(() => {
    mockState.error = null
    mockState.response = {
      content: [{ type: 'text', text: '{"pass":true}' }],
      usage: { input_tokens: 20, output_tokens: 10 }
    }
  })

  it('returns ChatResult on success', async () => {
    const provider = new ClaudeAuditProvider(claudeConfig())
    const result = await provider.chat('test prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('{"pass":true}')
      expect(result.value.promptTokens).toBe(20)
      expect(result.value.completionTokens).toBe(10)
      expect(result.value.totalTokens).toBe(30)
    }
  })

  it('returns err on API error', async () => {
    mockState.error = new Error('quota exceeded')
    const provider = new ClaudeAuditProvider(claudeConfig())
    const result = await provider.chat('prompt')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toBe('quota exceeded')
  })

  it('handles non-text content block gracefully', async () => {
    mockState.response = {
      content: [{ type: 'tool_use', id: 'tu_1' }],
      usage: { input_tokens: 5, output_tokens: 5 }
    }
    const provider = new ClaudeAuditProvider(claudeConfig())
    const result = await provider.chat('prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.content).toBe('')
  })

  it('handles missing usage gracefully', async () => {
    mockState.response = {
      content: [{ type: 'text', text: 'hello' }],
      usage: {}
    }
    const provider = new ClaudeAuditProvider(claudeConfig())
    const result = await provider.chat('prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.totalTokens).toBe(0)
  })
})

describe('ClaudeAuditProvider.ping', () => {
  beforeEach(() => {
    mockState.error = null
    mockState.response = {
      content: [{ type: 'text', text: 'pong' }],
      usage: { input_tokens: 1, output_tokens: 1 }
    }
  })

  it('returns latencyMs and model on success', async () => {
    const provider = new ClaudeAuditProvider(claudeConfig())
    const result = await provider.ping()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.model).toBe('claude-sonnet-4-6')
      expect(result.value.latencyMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns err when API call fails', async () => {
    mockState.error = new Error('network failure')
    const provider = new ClaudeAuditProvider(claudeConfig())
    const result = await provider.ping()
    expect(result.isErr()).toBe(true)
  })
})
