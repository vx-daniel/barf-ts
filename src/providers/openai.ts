import OpenAI from 'openai'
import { Result, ok, ResultAsync } from 'neverthrow'
import { AuditProvider } from '@/providers/base'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import { inferTier, prettifyModelId, OPENAI_TIERS } from '@/providers/model-tiers'
import type { Config } from '@/types'
import {
  DEFAULT_TEMPERATURE,
  toTokenUsage,
  type ChatResult,
  type ChatOptions,
  type ModelInfo,
  type PingResult,
  type ProviderInfo,
  type TokenUsage
} from '@/types/schema/provider-schema'

/** Factory that constructs an OpenAI SDK client given an API key. Injectable for tests. */
type OpenAIFactory = (apiKey: string) => OpenAI

const logger = createLogger('openai')

/**
 * Audit provider backed by the OpenAI chat completions API.
 * Extends {@link AuditProvider} — use `createAuditProvider` to instantiate.
 *
 * @category Providers
 */
export class OpenAIAuditProvider extends AuditProvider {
  readonly name = 'openai'
  private readonly config: Config
  private readonly clientFactory: OpenAIFactory

  constructor(config: Config, clientFactory: OpenAIFactory = k => new OpenAI({ apiKey: k })) {
    super()
    this.config = config
    this.clientFactory = clientFactory
  }

  /**
   * Returns OpenAI provider metadata including required config keys.
   *
   * @returns Provider info with name, display name, required keys, and supported models.
   */
  describe(): ProviderInfo {
    return {
      name: 'openai',
      displayName: 'OpenAI',
      requiredConfigKeys: ['openaiApiKey'],
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']
    }
  }

  /**
   * Returns true when `openaiApiKey` is non-empty in config.
   *
   * @param config - Loaded barf configuration.
   */
  isConfigured(config: Config): boolean {
    return config.openaiApiKey.length > 0
  }

  private async pingImpl(): Promise<PingResult> {
    const model = this.config.auditModel
    const start = Date.now()
    const client = this.clientFactory(this.config.openaiApiKey)
    await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1
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

  private async chatImpl(prompt: string, opts?: ChatOptions): Promise<ChatResult> {
    const client = this.clientFactory(this.config.openaiApiKey)
    logger.debug(
      { model: this.config.auditModel, promptLen: prompt.length },
      'sending chat completion'
    )

    const response = await client.chat.completions.create({
      model: this.config.auditModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: opts?.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: opts?.maxTokens,
      ...(opts?.jsonMode ? { response_format: { type: 'json_object' as const } } : {})
    })

    const parsed = this.parseResponse({ choices: response.choices, usage: response.usage })
    if (parsed.isErr()) {
      throw parsed.error
    }
    return this.normalizeResponse(parsed.value)
  }

  /**
   * Sends a single-turn prompt to the OpenAI API.
   *
   * @param prompt - Full prompt text.
   * @param opts - Optional temperature, max tokens, and JSON mode.
   * @returns `ok(ChatResult)` on success, `err(Error)` on API failure.
   */
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    return ResultAsync.fromPromise(this.chatImpl(prompt, opts), toError)
  }

  private async listModelsImpl(): Promise<ModelInfo[]> {
    const client = this.clientFactory(this.config.openaiApiKey)
    const models: ModelInfo[] = []
    const excluded = /embed|whisper|tts|dall-e|image/
    for await (const model of client.models.list()) {
      const id = model.id
      if (!(id.startsWith('gpt-') || id.startsWith('o'))) {
        continue
      }
      if (excluded.test(id)) {
        continue
      }
      models.push({ id, displayName: prettifyModelId(id), tier: inferTier(id, OPENAI_TIERS) })
    }
    return models
  }

  /**
   * Lists available OpenAI chat models with tier annotations.
   * Filters to `gpt-*` and `o*` models, excluding embedding/audio/image models.
   * Tier classification uses {@link OPENAI_TIERS} with keyword fallback via {@link inferTier}.
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
   * Extracts content and token counts from an OpenAI chat completion response.
   *
   * @param raw - Raw response object from the OpenAI SDK.
   * @returns `ok({ content, usage })` on success, `err(Error)` if shape is unexpected.
   */
  protected parseResponse(raw: unknown): Result<{ content: string; usage: TokenUsage }, Error> {
    const r = raw as {
      choices?: Array<{ message?: { content?: string | null } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }
    const content = r.choices?.[0]?.message?.content ?? ''
    const usage = toTokenUsage(
      r.usage?.prompt_tokens,
      r.usage?.completion_tokens,
      r.usage?.total_tokens
    )
    logger.debug(
      { promptTokens: usage.promptTokens, totalTokens: usage.totalTokens },
      'chat completion done'
    )
    return ok({ content, usage })
  }
}
