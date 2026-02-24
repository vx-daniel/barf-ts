import { describe, it, expect, beforeEach } from 'bun:test'
import { OpenAIAuditProvider } from '@/providers/openai'
import { defaultConfig } from '@tests/fixtures/provider'

const mockState = {
  lastArgs: null as unknown,
  error: null as Error | null,
  response: {
    choices: [{ message: { content: '{"pass":true}' } }],
    usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
  } as unknown
}

function makeMockClient() {
  return {
    chat: {
      completions: {
        create: async (args: unknown) => {
          mockState.lastArgs = args
          if (mockState.error) throw mockState.error
          return mockState.response
        }
      }
    },
    models: {
      list: async function* () {}
    }
  }
}

describe('OpenAIAuditProvider.describe', () => {
  it('returns openai name and requiredConfigKeys', () => {
    const provider = new OpenAIAuditProvider(defaultConfig(), () => makeMockClient() as never)
    const info = provider.describe()
    expect(info.name).toBe('openai')
    expect(info.requiredConfigKeys).toContain('openaiApiKey')
  })
})

describe('OpenAIAuditProvider.isConfigured', () => {
  it('returns true when openaiApiKey is set', () => {
    const cfg = { ...defaultConfig(), openaiApiKey: 'sk-test' }
    const provider = new OpenAIAuditProvider(cfg, () => makeMockClient() as never)
    expect(provider.isConfigured(cfg)).toBe(true)
  })
  it('returns false when openaiApiKey is empty', () => {
    const provider = new OpenAIAuditProvider(defaultConfig(), () => makeMockClient() as never)
    expect(provider.isConfigured(defaultConfig())).toBe(false)
  })
})

describe('OpenAIAuditProvider.chat', () => {
  beforeEach(() => {
    mockState.lastArgs = null
    mockState.error = null
    mockState.response = {
      choices: [{ message: { content: '{"pass":true}' } }],
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
    }
  })

  it('returns ChatResult on success', async () => {
    const provider = new OpenAIAuditProvider(
      { ...defaultConfig(), openaiApiKey: 'sk-test' },
      () => makeMockClient() as never
    )
    const result = await provider.chat('test prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('{"pass":true}')
      expect(result.value.promptTokens).toBe(50)
      expect(result.value.totalTokens).toBe(80)
    }
  })

  it('passes model and temperature to SDK', async () => {
    const provider = new OpenAIAuditProvider(
      { ...defaultConfig(), openaiApiKey: 'sk-test', auditModel: 'gpt-4o-mini' },
      () => makeMockClient() as never
    )
    await provider.chat('prompt', { temperature: 0.5 })
    const args = mockState.lastArgs as Record<string, unknown>
    expect(args.model).toBe('gpt-4o-mini')
    expect(args.temperature).toBe(0.5)
  })

  it('sets response_format when jsonMode is true', async () => {
    const provider = new OpenAIAuditProvider(
      { ...defaultConfig(), openaiApiKey: 'sk-test' },
      () => makeMockClient() as never
    )
    await provider.chat('prompt', { jsonMode: true })
    const args = mockState.lastArgs as Record<string, unknown>
    expect(args.response_format).toEqual({ type: 'json_object' })
  })

  it('returns err on API error', async () => {
    mockState.error = new Error('rate limited')
    const provider = new OpenAIAuditProvider(
      { ...defaultConfig(), openaiApiKey: 'sk-test' },
      () => makeMockClient() as never
    )
    const result = await provider.chat('prompt')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toBe('rate limited')
  })

  it('handles missing usage gracefully', async () => {
    mockState.response = { choices: [{ message: { content: 'hi' } }], usage: undefined }
    const provider = new OpenAIAuditProvider(
      { ...defaultConfig(), openaiApiKey: 'sk-test' },
      () => makeMockClient() as never
    )
    const result = await provider.chat('prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.totalTokens).toBe(0)
  })
})

describe('OpenAIAuditProvider.ping', () => {
  beforeEach(() => {
    mockState.error = null
    mockState.response = {
      choices: [{ message: { content: 'pong' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    }
  })

  it('returns latencyMs and model on success', async () => {
    const provider = new OpenAIAuditProvider(
      { ...defaultConfig(), openaiApiKey: 'sk-test', auditModel: 'gpt-4o' },
      () => makeMockClient() as never
    )
    const result = await provider.ping()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.model).toBe('gpt-4o')
      expect(result.value.latencyMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns err when API call fails', async () => {
    mockState.error = new Error('network failure')
    const provider = new OpenAIAuditProvider(
      { ...defaultConfig(), openaiApiKey: 'sk-test' },
      () => makeMockClient() as never
    )
    const result = await provider.ping()
    expect(result.isErr()).toBe(true)
  })
})
