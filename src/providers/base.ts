/** @module Audit Providers */
import { errAsync, type Result, ResultAsync } from 'neverthrow'
import type { ZodType } from 'zod'
import type { Config } from '@/types'
import type {
  ChatOptions,
  ChatResult,
  ModelInfo,
  PingResult,
  ProviderInfo,
  TokenUsage,
} from '@/types/schema/provider-schema'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

export type {
  ChatResult,
  ChatOptions,
  PingResult,
  ProviderInfo,
  TokenUsage,
  ModelInfo,
}

const logger = createLogger('providers')

/**
 * Abstract base class for single-turn AI audit providers.
 *
 * Subclasses implement `chat`, `parseResponse`, `ping`, `describe`, and
 * `isConfigured`. The concrete methods `chatJSON` and `normalizeResponse`
 * are inherited and shared across all providers.
 *
 * @example
 * ```ts
 * const provider = createAuditProvider(config)
 * const result = await provider.chatJSON(prompt, AuditResponseSchema)
 * ```
 *
 * @category Providers
 */
export abstract class AuditProvider {
  /** Programmatic identifier used in config and logs (e.g. `'openai'`, `'gemini'`). */
  abstract readonly name: string

  /**
   * Returns static metadata about this provider.
   * No network call — safe to call before `isConfigured`.
   *
   * @returns Provider name, display name, required config keys, and supported models.
   */
  abstract describe(): ProviderInfo

  /**
   * Returns true if all required API keys are set in `config`.
   * Use this to short-circuit before making network calls.
   *
   * @param config - Loaded barf configuration.
   */
  abstract isConfigured(config: Config): boolean

  /**
   * Makes a minimal API call to verify connectivity and authentication.
   *
   * @returns `ok({ latencyMs, model })` on success, `err(Error)` on failure.
   */
  abstract ping(): ResultAsync<PingResult, Error>

  /**
   * Sends a single-turn prompt and returns the canonical {@link ChatResult}.
   *
   * @param prompt - The full prompt text to send.
   * @param opts - Optional temperature, max tokens, and JSON mode flag.
   * @returns `ok(ChatResult)` on success, `err(Error)` on API failure.
   */
  abstract chat(
    prompt: string,
    opts?: ChatOptions,
  ): ResultAsync<ChatResult, Error>

  /**
   * Queries the provider's API for available models with tier annotations.
   * Implementations should filter to chat-capable models only and apply
   * tier classification via `inferTier` from `@/providers/model-tiers`.
   *
   * @returns `ok(ModelInfo[])` on success, `err(Error)` on API failure.
   * @example
   * const result = await provider.listModels()
   * if (result.isOk()) {
   *   const frontier = result.value.filter(m => m.tier === 'frontier')
   * }
   */
  abstract listModels(): ResultAsync<ModelInfo[], Error>

  /**
   * Extracts content and token usage from a provider-specific raw API response.
   * Called internally by `chat` implementations.
   *
   * @param raw - The raw response object from the provider SDK.
   * @returns `ok({ content, usage })` on success, `err(Error)` if the response shape is unexpected.
   */
  protected abstract parseResponse(
    raw: unknown,
  ): Result<{ content: string; usage: TokenUsage }, Error>

  /**
   * Maps the intermediate `{ content, usage }` shape to barf's canonical {@link ChatResult}.
   * Trims content whitespace and zero-fills missing token counts.
   *
   * @param raw - Intermediate shape returned by `parseResponse`.
   * @returns Canonical `ChatResult`.
   */
  protected normalizeResponse(raw: {
    content: string
    usage: TokenUsage
  }): ChatResult {
    return {
      content: raw.content.trim(),
      promptTokens: raw.usage.promptTokens,
      completionTokens: raw.usage.completionTokens,
      totalTokens: raw.usage.totalTokens,
    }
  }

  /**
   * Sends a prompt and parses the response against a Zod schema.
   * Combines `chat` + JSON.parse + schema validation into one typed call.
   *
   * @param prompt - The full prompt text.
   * @param schema - Zod schema to validate the parsed JSON response against.
   * @param opts - Optional chat options.
   * @returns `ok(T)` on success, `err(Error)` if the call fails, JSON is invalid, or schema validation fails.
   */
  chatJSON<T>(
    prompt: string,
    schema: ZodType<T>,
    opts?: ChatOptions,
  ): ResultAsync<T, Error> {
    return this.chat(prompt, opts).andThen((result) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(result.content)
      } catch {
        logger.debug(
          { provider: this.name, content: result.content.slice(0, 100) },
          'response is not valid JSON',
        )
        return errAsync(new Error(`${this.name} returned invalid JSON`))
      }
      const validation = schema.safeParse(parsed)
      if (!validation.success) {
        logger.debug(
          { provider: this.name, issues: validation.error.issues },
          'response failed schema validation',
        )
        return errAsync(
          new Error(
            `${this.name} response failed schema validation: ${validation.error.message}`,
          ),
        )
      }
      return ResultAsync.fromPromise(Promise.resolve(validation.data), toError)
    })
  }
}
