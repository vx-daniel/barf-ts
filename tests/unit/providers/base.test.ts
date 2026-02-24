import { describe, it, expect } from 'bun:test'
import { ok, err, okAsync, ResultAsync } from 'neverthrow'
import { z } from 'zod'
import { AuditProvider } from '@/providers/base'
import type { ChatResult, ChatOptions, ModelInfo, PingResult, ProviderInfo, TokenUsage } from '@/types/schema/provider-schema'
import type { Config } from '@/types'

// Minimal stub — only implements abstract methods
class MockAuditProvider extends AuditProvider {
  name = 'mock'
  private _chatContent: string
  private _chatErr: Error | null

  constructor(chatContent = '{"key":"value"}', chatErr: Error | null = null) {
    super()
    this._chatContent = chatContent
    this._chatErr = chatErr
  }

  describe(): ProviderInfo {
    return { name: 'mock', displayName: 'Mock', requiredConfigKeys: ['mockKey'], supportedModels: ['mock-model'] }
  }

  isConfigured(_config: Config): boolean { return true }

  ping(): ResultAsync<PingResult, Error> {
    return ResultAsync.fromPromise(Promise.resolve({ latencyMs: 10, model: 'mock-model' }), e => e as Error)
  }

  chat(_prompt: string, _opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    if (this._chatErr) return ResultAsync.fromPromise(Promise.reject(this._chatErr), e => e as Error)
    return ResultAsync.fromPromise(
      Promise.resolve({ content: this._chatContent, promptTokens: 5, completionTokens: 3, totalTokens: 8 }),
      e => e as Error
    )
  }

  listModels(): ResultAsync<ModelInfo[], Error> {
    return okAsync([])
  }

  protected parseResponse(_raw: unknown): ReturnType<AuditProvider['parseResponse']> {
    return ok({ content: 'parsed', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } })
  }
}

describe('AuditProvider.normalizeResponse', () => {
  it('trims content whitespace', () => {
    const provider = new MockAuditProvider()
    // Access protected method via cast for testing
    const result = (provider as unknown as { normalizeResponse: (r: { content: string; usage: TokenUsage }) => ChatResult })
      .normalizeResponse({ content: '  hello  ', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } })
    expect(result.content).toBe('hello')
  })

  it('defaults missing token counts to 0', () => {
    const provider = new MockAuditProvider()
    const result = (provider as unknown as { normalizeResponse: (r: { content: string; usage: TokenUsage }) => ChatResult })
      .normalizeResponse({ content: 'x', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } })
    expect(result.promptTokens).toBe(0)
    expect(result.completionTokens).toBe(0)
  })
})

describe('AuditProvider.chatJSON', () => {
  const Schema = z.object({ key: z.string() })

  it('returns parsed typed value when chat succeeds and JSON is valid', async () => {
    const provider = new MockAuditProvider('{"key":"value"}')
    const result = await provider.chatJSON('prompt', Schema)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.key).toBe('value')
    }
  })

  it('returns err when chat fails', async () => {
    const provider = new MockAuditProvider('{}', new Error('API down'))
    const result = await provider.chatJSON('prompt', Schema)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toBe('API down')
    }
  })

  it('returns err when response is not valid JSON', async () => {
    const provider = new MockAuditProvider('not json')
    const result = await provider.chatJSON('prompt', Schema)
    expect(result.isErr()).toBe(true)
  })

  it('returns err when JSON does not match schema', async () => {
    const provider = new MockAuditProvider('{"wrong":123}')
    const result = await provider.chatJSON('prompt', Schema)
    expect(result.isErr()).toBe(true)
  })
})
