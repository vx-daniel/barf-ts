import { GoogleGenerativeAI } from '@google/generative-ai'
import { Result, ok, ResultAsync } from 'neverthrow'
import { AuditProvider } from '@/providers/base'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import type { Config } from '@/types'
import type {
  ChatResult,
  ChatOptions,
  PingResult,
  ProviderInfo,
  TokenUsage
} from '@/types/schema/provider-schema'

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

  constructor(config: Config) {
    super()
    this.config = config
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

  /**
   * Sends a minimal prompt to verify connectivity and API key validity.
   *
   * @returns `ok({ latencyMs, model })` on success, `err(Error)` on failure.
   */
  ping(): ResultAsync<PingResult, Error> {
    const model = this.config.geminiModel
    return ResultAsync.fromPromise(
      (async (): Promise<PingResult> => {
        const start = Date.now()
        const client = new GoogleGenerativeAI(this.config.geminiApiKey)
        const genModel = client.getGenerativeModel({ model })
        await genModel.generateContent('ping')
        return { latencyMs: Date.now() - start, model }
      })(),
      toError
    )
  }

  /**
   * Sends a single-turn prompt to the Gemini API.
   *
   * @param prompt - Full prompt text.
   * @param opts - Optional temperature, max tokens, and JSON mode.
   * @returns `ok(ChatResult)` on success, `err(Error)` on API failure.
   */
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    return ResultAsync.fromPromise(
      (async (): Promise<ChatResult> => {
        const client = new GoogleGenerativeAI(this.config.geminiApiKey)
        const genModel = client.getGenerativeModel({
          model: this.config.geminiModel,
          generationConfig: {
            temperature: opts?.temperature ?? 0.2,
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
      })(),
      toError
    )
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
    const usage: TokenUsage = {
      promptTokens: r.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: r.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: r.usageMetadata?.totalTokenCount ?? 0
    }
    logger.debug(
      { promptTokens: usage.promptTokens, totalTokens: usage.totalTokens },
      'gemini chat done'
    )
    return ok({ content, usage })
  }
}
