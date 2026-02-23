import Anthropic from '@anthropic-ai/sdk'
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

  constructor(config: Config) {
    super()
    this.config = config
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
      supportedModels: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
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

  /**
   * Sends a minimal prompt to verify connectivity and API key validity.
   *
   * @returns `ok({ latencyMs, model })` on success, `err(Error)` on failure.
   */
  ping(): ResultAsync<PingResult, Error> {
    const model = this.config.claudeAuditModel
    return ResultAsync.fromPromise(
      (async (): Promise<PingResult> => {
        const start = Date.now()
        const client = new Anthropic({ apiKey: this.config.anthropicApiKey })
        await client.messages.create({
          model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        })
        return { latencyMs: Date.now() - start, model }
      })(),
      toError
    )
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
    return ResultAsync.fromPromise(
      (async (): Promise<ChatResult> => {
        const client = new Anthropic({ apiKey: this.config.anthropicApiKey })
        logger.debug(
          { model: this.config.claudeAuditModel, promptLen: prompt.length },
          'sending claude messages call'
        )

        const response = await client.messages.create({
          model: this.config.claudeAuditModel,
          max_tokens: opts?.maxTokens ?? 4096,
          messages: [{ role: 'user', content: prompt }]
        })

        const parsed = this.parseResponse(response)
        if (parsed.isErr()) {
          throw parsed.error
        }
        return this.normalizeResponse(parsed.value)
      })(),
      toError
    )
  }

  /**
   * Extracts content and token counts from an Anthropic Messages API response.
   *
   * @param raw - Raw response object from the Anthropic SDK.
   * @returns `ok({ content, usage })` on success, `err(Error)` if shape is unexpected.
   */
  protected parseResponse(raw: unknown): Result<{ content: string; usage: TokenUsage }, Error> {
    const r = raw as {
      content?: Array<{ type?: string; text?: string }>
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const firstBlock = r.content?.[0]
    const content = firstBlock?.type === 'text' ? (firstBlock.text ?? '') : ''
    const promptTokens = r.usage?.input_tokens ?? 0
    const completionTokens = r.usage?.output_tokens ?? 0
    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens
    }
    logger.debug(
      { promptTokens: usage.promptTokens, totalTokens: usage.totalTokens },
      'claude messages call done'
    )
    return ok({ content, usage })
  }
}
