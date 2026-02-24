import { GoogleGenerativeAI } from '@google/generative-ai'
import { Result, ok, ResultAsync } from 'neverthrow'
import { AuditProvider } from '@/providers/base'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import { inferTier, GEMINI_TIERS } from '@/providers/model-tiers'
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

const GEMINI_LIST_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Factory that constructs a GoogleGenerativeAI client given an API key. Injectable for tests. */
export type GeminiFactory = (apiKey: string) => GoogleGenerativeAI

const logger = createLogger('gemini')

/**
 * Audit provider backed by the Google Gemini generative AI API.
 * Extends {@link AuditProvider} — use `createAuditProvider` to instantiate.
 *
 * @category Providers
 */
export class GeminiAuditProvider extends AuditProvider {
  readonly name = 'gemini'
  private readonly config: Config
  private readonly clientFactory: GeminiFactory

  constructor(config: Config, clientFactory: GeminiFactory = k => new GoogleGenerativeAI(k)) {
    super()
    this.config = config
    this.clientFactory = clientFactory
  }

  /**
   * Returns Gemini provider metadata including required config keys.
   *
   * @returns Provider info with name, display name, required keys, and supported models.
   */
  describe(): ProviderInfo {
    return {
      name: 'gemini',
      displayName: 'Google Gemini',
      requiredConfigKeys: ['geminiApiKey'],
      supportedModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash']
    }
  }

  /**
   * Returns true when `geminiApiKey` is non-empty in config.
   *
   * @param config - Loaded barf configuration.
   */
  isConfigured(config: Config): boolean {
    return config.geminiApiKey.length > 0
  }

  private async pingImpl(): Promise<PingResult> {
    const model = this.config.geminiModel
    const start = Date.now()
    const client = this.clientFactory(this.config.geminiApiKey)
    const genModel = client.getGenerativeModel({ model })
    await genModel.generateContent('ping')
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
    const client = this.clientFactory(this.config.geminiApiKey)
    const genModel = client.getGenerativeModel({
      model: this.config.geminiModel,
      generationConfig: {
        temperature: opts?.temperature ?? DEFAULT_TEMPERATURE,
        maxOutputTokens: opts?.maxTokens,
        ...(opts?.jsonMode ? { responseMimeType: 'application/json' } : {})
      }
    })

    logger.debug(
      { model: this.config.geminiModel, promptLen: prompt.length },
      'sending gemini chat'
    )

    const response = await genModel.generateContent(prompt)
    const parsed = this.parseResponse(response.response)
    if (parsed.isErr()) {
      throw parsed.error
    }
    return this.normalizeResponse(parsed.value)
  }

  /**
   * Sends a single-turn prompt to the Gemini API.
   *
   * @param prompt - Full prompt text.
   * @param opts - Optional temperature, max tokens, and JSON mode.
   * @returns `ok(ChatResult)` on success, `err(Error)` on API failure.
   */
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    return ResultAsync.fromPromise(this.chatImpl(prompt, opts), toError)
  }

  private async listModelsImpl(): Promise<ModelInfo[]> {
    const url = `${GEMINI_LIST_MODELS_URL}?key=${this.config.geminiApiKey}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Gemini listModels failed: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as {
      models?: Array<{
        name?: string
        displayName?: string
        supportedGenerationMethods?: string[]
      }>
    }
    const models: ModelInfo[] = []
    for (const m of data.models ?? []) {
      const name = m.name ?? ''
      if (!name.startsWith('models/gemini-')) {
        continue
      }
      if (!m.supportedGenerationMethods?.includes('generateContent')) {
        continue
      }
      const id = name.replace(/^models\//, '')
      models.push({
        id,
        displayName: m.displayName ?? id,
        tier: inferTier(id, GEMINI_TIERS)
      })
    }
    return models
  }

  /**
   * Lists available Gemini models with tier annotations.
   * Uses the REST API (`GET /v1beta/models`) since the `@google/generative-ai` SDK has no listModels.
   * Filters to `gemini-*` models that support `generateContent`.
   * Tier classification uses {@link GEMINI_TIERS} with keyword fallback via {@link inferTier}.
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
   * Extracts content and token counts from a Gemini API response.
   *
   * @param raw - Raw response object from the Gemini SDK.
   * @returns `ok({ content, usage })` on success, `err(Error)` if shape is unexpected.
   */
  protected parseResponse(raw: unknown): Result<{ content: string; usage: TokenUsage }, Error> {
    const r = raw as {
      text?: () => string
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }
    }
    const content = r.text?.() ?? ''
    const usage = toTokenUsage(
      r.usageMetadata?.promptTokenCount,
      r.usageMetadata?.candidatesTokenCount,
      r.usageMetadata?.totalTokenCount
    )
    logger.debug(
      { promptTokens: usage.promptTokens, totalTokens: usage.totalTokens },
      'gemini chat done'
    )
    return ok({ content, usage })
  }
}
