/** @module Audit Providers */
import Anthropic from '@anthropic-ai/sdk'
import { ok, type Result, ResultAsync } from 'neverthrow'
import { AuditProvider } from '@/providers/base'
import { CLAUDE_TIERS, inferTier } from '@/providers/model-tiers'
import type { Config } from '@/types'
import {
  type ChatOptions,
  type ChatResult,
  type ModelInfo,
  type PingResult,
  type ProviderInfo,
  type TokenUsage,
  toTokenUsage,
} from '@/types/schema/provider-schema'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

/** Factory that constructs an Anthropic SDK client given an API key. Injectable for tests. */
export type AnthropicFactory = (apiKey: string) => Anthropic

const logger = createLogger('claude')

/**
 * Audit provider backed by the Anthropic Claude Messages API.
 * Extends {@link AuditProvider} — use `createAuditProvider` to instantiate.
 *
 * Uses the SDK directly for single-turn calls (not the subprocess approach in
 * `core/claude.ts`, which is reserved for multi-turn streaming agent work).
 *
 * @category Providers
 */
export class ClaudeAuditProvider extends AuditProvider {
  readonly name = 'claude'
  private readonly config: Config
  private readonly clientFactory: AnthropicFactory

  constructor(
    config: Config,
    clientFactory: AnthropicFactory = (k) => new Anthropic({ apiKey: k }),
  ) {
    super()
    this.config = config
    this.clientFactory = clientFactory
  }

  /**
   * Returns Claude provider metadata including required config keys.
   *
   * @returns Provider info with name, display name, required keys, and supported models.
   */
  describe(): ProviderInfo {
    return {
      name: 'claude',
      displayName: 'Anthropic Claude',
      requiredConfigKeys: ['anthropicApiKey'],
      supportedModels: [
        'claude-opus-4-6',
        'claude-sonnet-4-6',
        'claude-haiku-4-5-20251001',
      ],
    }
  }

  /**
   * Returns true when `anthropicApiKey` is non-empty in config.
   *
   * @param config - Loaded barf configuration.
   */
  isConfigured(config: Config): boolean {
    return config.anthropicApiKey.length > 0
  }

  private async pingImpl(): Promise<PingResult> {
    const model = this.config.claudeAuditModel
    const start = Date.now()
    const client = this.clientFactory(this.config.anthropicApiKey)
    await client.messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    })
    return { latencyMs: Date.now() - start, model }
  }

  /**
   * Sends a minimal prompt to verify connectivity and API key validity.
   *
   * @returns `ok({ latencyMs, model })` on success, `err(Error)` on failure.
   */
  ping(): ResultAsync<PingResult, Error> {
    return ResultAsync.fromPromise(this.pingImpl(), toError)
  }

  private async chatImpl(
    prompt: string,
    opts?: ChatOptions,
  ): Promise<ChatResult> {
    const client = this.clientFactory(this.config.anthropicApiKey)
    logger.debug(
      { model: this.config.claudeAuditModel, promptLen: prompt.length },
      'sending claude messages call',
    )

    const response = await client.messages.create({
      model: this.config.claudeAuditModel,
      max_tokens: opts?.maxTokens ?? 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const parsed = this.parseResponse(response)
    if (parsed.isErr()) {
      throw parsed.error
    }
    return this.normalizeResponse(parsed.value)
  }

  /**
   * Sends a single-turn prompt to the Anthropic Messages API.
   *
   * Note: `temperature` is omitted — it is only supported on extended thinking models.
   * `jsonMode` is treated as a no-op at the API level; the audit prompt already
   * instructs JSON output.
   *
   * @param prompt - Full prompt text.
   * @param opts - Optional max tokens (temperature and jsonMode are ignored).
   * @returns `ok(ChatResult)` on success, `err(Error)` on API failure.
   */
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    return ResultAsync.fromPromise(this.chatImpl(prompt, opts), toError)
  }

  private async listModelsImpl(): Promise<ModelInfo[]> {
    const client = this.clientFactory(this.config.anthropicApiKey)
    const models: ModelInfo[] = []
    for await (const model of client.models.list()) {
      const id = model.id
      if (!id.startsWith('claude-')) {
        continue
      }
      models.push({
        id,
        displayName: (model as { display_name?: string }).display_name ?? id,
        tier: inferTier(id, CLAUDE_TIERS),
      })
    }
    return models
  }

  /**
   * Lists available Anthropic Claude models with tier annotations.
   * Filters to `claude-*` models only. `displayName` comes from the API's `display_name` field.
   * Tier classification uses {@link CLAUDE_TIERS} with keyword fallback via {@link inferTier}.
   *
   * @returns `ok(ModelInfo[])` on success, `err(Error)` on API failure.
   * @example
   * const result = await provider.listModels()
   * if (result.isOk()) console.log(result.value)
   */
  listModels(): ResultAsync<ModelInfo[], Error> {
    return ResultAsync.fromPromise(this.listModelsImpl(), toError)
  }

  /**
   * Extracts content and token counts from an Anthropic Messages API response.
   *
   * @param raw - Raw response object from the Anthropic SDK.
   * @returns `ok({ content, usage })` on success, `err(Error)` if shape is unexpected.
   */
  protected parseResponse(
    raw: unknown,
  ): Result<{ content: string; usage: TokenUsage }, Error> {
    const r = raw as {
      content?: Array<{ type?: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const firstBlock = r.content?.[0]
    const content = firstBlock?.type === 'text' ? (firstBlock.text ?? '') : ''
    const usage = toTokenUsage(r.usage?.input_tokens, r.usage?.output_tokens)
    logger.debug(
      { promptTokens: usage.promptTokens, totalTokens: usage.totalTokens },
      'claude messages call done',
    )
    return ok({ content, usage })
  }
}
