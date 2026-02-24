import { describe, it, expect, beforeEach } from 'bun:test'
import { GeminiAuditProvider } from '@/providers/gemini'
import { defaultConfig } from '@tests/fixtures/provider'

const mockState = {
  error: null as Error | null,
  text: '{"pass":true}',
  usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 } as unknown
}

function makeMockClient() {
  return {
    getGenerativeModel(_opts: unknown) {
      return {
        generateContent: async (_prompt: string) => {
          if (mockState.error) throw mockState.error
          return {
            response: {
              text: () => mockState.text,
              usageMetadata: mockState.usageMetadata
            }
          }
        }
      }
    }
  }
}

const geminiConfig = () => ({
  ...defaultConfig(),
  geminiApiKey: 'gm-test',
  geminiModel: 'gemini-1.5-pro'
})

describe('GeminiAuditProvider.describe', () => {
  it('returns gemini name and requiredConfigKeys', () => {
    const provider = new GeminiAuditProvider(geminiConfig(), () => makeMockClient() as never)
    const info = provider.describe()
    expect(info.name).toBe('gemini')
    expect(info.requiredConfigKeys).toContain('geminiApiKey')
  })
})

describe('GeminiAuditProvider.isConfigured', () => {
  it('returns true when geminiApiKey is set', () => {
    const provider = new GeminiAuditProvider(geminiConfig(), () => makeMockClient() as never)
    expect(provider.isConfigured(geminiConfig())).toBe(true)
  })
  it('returns false when geminiApiKey is empty', () => {
    const cfg = { ...geminiConfig(), geminiApiKey: '' }
    const provider = new GeminiAuditProvider(cfg, () => makeMockClient() as never)
    expect(provider.isConfigured(cfg)).toBe(false)
  })
})

describe('GeminiAuditProvider.chat', () => {
  beforeEach(() => {
    mockState.error = null
    mockState.text = '{"pass":true}'
    mockState.usageMetadata = { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }
  })

  it('returns ChatResult on success', async () => {
    const provider = new GeminiAuditProvider(geminiConfig(), () => makeMockClient() as never)
    const result = await provider.chat('test prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('{"pass":true}')
      expect(result.value.promptTokens).toBe(20)
      expect(result.value.totalTokens).toBe(30)
    }
  })

  it('returns err on API error', async () => {
    mockState.error = new Error('quota exceeded')
    const provider = new GeminiAuditProvider(geminiConfig(), () => makeMockClient() as never)
    const result = await provider.chat('prompt')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toBe('quota exceeded')
  })

  it('handles missing usageMetadata gracefully', async () => {
    mockState.usageMetadata = undefined
    const provider = new GeminiAuditProvider(geminiConfig(), () => makeMockClient() as never)
    const result = await provider.chat('prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.totalTokens).toBe(0)
  })
})

describe('GeminiAuditProvider.ping', () => {
  beforeEach(() => {
    mockState.error = null
    mockState.text = 'pong'
    mockState.usageMetadata = { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
  })

  it('returns latencyMs and model on success', async () => {
    const provider = new GeminiAuditProvider(geminiConfig(), () => makeMockClient() as never)
    const result = await provider.ping()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.model).toBe('gemini-1.5-pro')
      expect(result.value.latencyMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns err when API call fails', async () => {
    mockState.error = new Error('network failure')
    const provider = new GeminiAuditProvider(geminiConfig(), () => makeMockClient() as never)
    const result = await provider.ping()
    expect(result.isErr()).toBe(true)
  })
})
