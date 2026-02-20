import { describe, it, expect } from 'bun:test'
import { OpenAIChatResultSchema, OpenAIChatOptionsSchema } from '@/types/schema/openai-schema'

describe('OpenAIChatResultSchema', () => {
  it('parses a valid result', () => {
    const input = {
      content: 'Hello world',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15
    }
    const result = OpenAIChatResultSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(input)
    }
  })

  it('rejects missing content', () => {
    expect(
      OpenAIChatResultSchema.safeParse({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      }).success
    ).toBe(false)
  })

  it('rejects missing token fields', () => {
    expect(
      OpenAIChatResultSchema.safeParse({ content: 'hi' }).success
    ).toBe(false)
  })
})

describe('OpenAIChatOptionsSchema', () => {
  it('parses with all fields', () => {
    const input = {
      temperature: 0.5,
      maxTokens: 1000,
      responseFormat: { type: 'json_object' as const }
    }
    const result = OpenAIChatOptionsSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('parses with no fields (all optional)', () => {
    const result = OpenAIChatOptionsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('parses with partial fields', () => {
    const result = OpenAIChatOptionsSchema.safeParse({ temperature: 0.8 })
    expect(result.success).toBe(true)
  })

  it('rejects invalid responseFormat type', () => {
    expect(
      OpenAIChatOptionsSchema.safeParse({
        responseFormat: { type: 'xml' }
      }).success
    ).toBe(false)
  })
})
