import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Shared state object — avoids Bun mock.module closure issues with individual let bindings
const mockState = {
  lastArgs: null as unknown,
  error: null as Error | null,
  response: {
    choices: [{ message: { content: '{"pass":true}' } }],
    usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
  } as unknown
}

mock.module('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async (args: unknown) => {
          mockState.lastArgs = args
          if (mockState.error) {
            throw mockState.error
          }
          return mockState.response
        }
      }
    }

    constructor(_opts: unknown) {
      // no-op
    }
  }
}))

import { runOpenAIChat } from '@/core/openai'

describe('runOpenAIChat', () => {
  beforeEach(() => {
    mockState.lastArgs = null
    mockState.error = null
    mockState.response = {
      choices: [{ message: { content: '{"pass":true}' } }],
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
    }
  })

  it('returns content and token counts on success', async () => {
    const result = await runOpenAIChat('test prompt', 'gpt-4o', 'sk-test')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('{"pass":true}')
      expect(result.value.promptTokens).toBe(50)
      expect(result.value.completionTokens).toBe(30)
      expect(result.value.totalTokens).toBe(80)
    }
  })

  it('passes model and temperature to the SDK', async () => {
    await runOpenAIChat('prompt', 'gpt-4o-mini', 'sk-key', { temperature: 0.5 })
    const args = mockState.lastArgs as Record<string, unknown>
    expect(args).not.toBeNull()
    expect(args.model).toBe('gpt-4o-mini')
    expect(args.temperature).toBe(0.5)
  })

  it('defaults temperature to 0.2', async () => {
    await runOpenAIChat('prompt', 'gpt-4o', 'sk-key')
    const args = mockState.lastArgs as Record<string, unknown>
    expect(args).not.toBeNull()
    expect(args.temperature).toBe(0.2)
  })

  it('passes response_format when specified', async () => {
    await runOpenAIChat('prompt', 'gpt-4o', 'sk-key', {
      responseFormat: { type: 'json_object' }
    })
    const args = mockState.lastArgs as Record<string, unknown>
    expect(args).not.toBeNull()
    expect(args.response_format).toEqual({ type: 'json_object' })
  })

  it('returns err on API error', async () => {
    mockState.error = new Error('API rate limit exceeded')
    const result = await runOpenAIChat('prompt', 'gpt-4o', 'sk-key')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toBe('API rate limit exceeded')
    }
  })

  it('handles empty content gracefully', async () => {
    mockState.response = {
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }
    }
    const result = await runOpenAIChat('prompt', 'gpt-4o', 'sk-key')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('')
    }
  })

  it('handles missing usage gracefully', async () => {
    mockState.response = {
      choices: [{ message: { content: 'hi' } }],
      usage: undefined
    }
    const result = await runOpenAIChat('prompt', 'gpt-4o', 'sk-key')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.promptTokens).toBe(0)
      expect(result.value.completionTokens).toBe(0)
      expect(result.value.totalTokens).toBe(0)
    }
  })
})
