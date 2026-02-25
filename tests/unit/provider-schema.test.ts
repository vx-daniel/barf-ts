import { describe, it, expect } from 'bun:test'
import {
  TokenUsageSchema,
  ChatResultSchema,
  ChatOptionsSchema,
  PingResultSchema,
  ProviderInfoSchema,
} from '@/types/schema/provider-schema'

describe('TokenUsageSchema', () => {
  it('parses full usage', () => {
    const result = TokenUsageSchema.safeParse({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    })
    expect(result.success).toBe(true)
  })
  it('defaults all counts to 0 when missing', () => {
    const result = TokenUsageSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.promptTokens).toBe(0)
      expect(result.data.completionTokens).toBe(0)
      expect(result.data.totalTokens).toBe(0)
    }
  })
})

describe('ChatResultSchema', () => {
  it('parses valid result', () => {
    const result = ChatResultSchema.safeParse({
      content: 'hello',
      promptTokens: 5,
      completionTokens: 3,
      totalTokens: 8,
    })
    expect(result.success).toBe(true)
  })
  it('rejects missing content', () => {
    expect(
      ChatResultSchema.safeParse({
        promptTokens: 5,
        completionTokens: 3,
        totalTokens: 8,
      }).success,
    ).toBe(false)
  })
})

describe('ChatOptionsSchema', () => {
  it('parses empty options (all optional)', () => {
    expect(ChatOptionsSchema.safeParse({}).success).toBe(true)
  })
  it('parses temperature, maxTokens, jsonMode', () => {
    const result = ChatOptionsSchema.safeParse({
      temperature: 0.5,
      maxTokens: 500,
      jsonMode: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('PingResultSchema', () => {
  it('parses latencyMs and model', () => {
    const result = PingResultSchema.safeParse({
      latencyMs: 120,
      model: 'gpt-4o',
    })
    expect(result.success).toBe(true)
  })
  it('rejects missing latencyMs', () => {
    expect(PingResultSchema.safeParse({ model: 'gpt-4o' }).success).toBe(false)
  })
})

describe('ProviderInfoSchema', () => {
  it('parses a full provider info object', () => {
    const result = ProviderInfoSchema.safeParse({
      name: 'openai',
      displayName: 'OpenAI',
      requiredConfigKeys: ['openaiApiKey'],
      supportedModels: ['gpt-4o', 'gpt-4o-mini'],
    })
    expect(result.success).toBe(true)
  })
  it('rejects missing requiredConfigKeys', () => {
    expect(
      ProviderInfoSchema.safeParse({
        name: 'openai',
        displayName: 'OpenAI',
        supportedModels: [],
      }).success,
    ).toBe(false)
  })
})
