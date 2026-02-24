import { ok, Result, ResultAsync } from 'neverthrow'
import { AuditProvider } from '@/providers/base'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import type { Config } from '@/types'
import {
  toTokenUsage,
  type ChatResult,
  type ChatOptions,
  type PingResult,
  type ProviderInfo,
  type TokenUsage
} from '@/types/schema/provider-schema'

const logger = createLogger('codex')

/**
 * Audit provider backed by the `@openai/codex` CLI.
 * Runs `codex -q <prompt>` as a subprocess — no API key required,
 * authentication is handled by the user's codex CLI session.
 *
 * Token counts are always zero (the CLI does not expose them).
 * Extends {@link AuditProvider} — use `createAuditProvider` to instantiate.
 *
 * @category Providers
 */
export class CodexAuditProvider extends AuditProvider {
  readonly name = 'codex'
  private readonly config: Config

  constructor(config: Config) {
    super()
    this.config = config
  }

  /**
   * Returns Codex provider metadata.
   * No required config keys — codex authenticates via its own CLI session.
   *
   * @returns Provider info with name, display name, empty required keys, and supported models.
   */
  describe(): ProviderInfo {
    return {
      name: 'codex',
      displayName: 'OpenAI Codex (CLI)',
      requiredConfigKeys: [],
      supportedModels: ['codex']
    }
  }

  /**
   * Always returns true — codex requires no config keys.
   * Availability is only determined at runtime when the subprocess runs.
   *
   * @param _config - Unused; no config keys required for codex.
   */
  isConfigured(_config: Config): boolean {
    return true
  }

  private async pingImpl(): Promise<PingResult> {
    const start = Date.now()
    const result = await execFileNoThrow('codex', [
      'exec', '--full-auto', '--ephemeral', 'Say only the word "pong".'
    ])
    if (result.status !== 0) {
      throw new Error(`codex ping failed (exit ${result.status}): ${result.stderr}`)
    }
    return { latencyMs: Date.now() - start, model: 'codex' }
  }

  /**
   * Runs a minimal codex prompt to verify the CLI is installed and authenticated.
   *
   * @returns `ok({ latencyMs, model })` on success, `err(Error)` if codex is not found or fails.
   */
  ping(): ResultAsync<PingResult, Error> {
    return ResultAsync.fromPromise(this.pingImpl(), toError)
  }

  private async chatImpl(prompt: string, _opts?: ChatOptions): Promise<ChatResult> {
    logger.debug({ promptLen: prompt.length }, 'sending codex prompt')
    const result = await execFileNoThrow('codex', ['exec', '--full-auto', '--ephemeral', prompt])
    if (result.status !== 0) {
      throw new Error(`codex exited with status ${result.status}: ${result.stderr}`)
    }
    const parsed = this.parseResponse({ content: result.stdout })
    if (parsed.isErr()) {
      throw parsed.error
    }
    return this.normalizeResponse(parsed.value)
  }

  /**
   * Runs `codex exec --full-auto --ephemeral <prompt>` as a subprocess and returns stdout as the response.
   * Token counts are always zero — the codex CLI does not expose them.
   *
   * @param prompt - Full prompt text.
   * @param _opts - Ignored; temperature/maxTokens/jsonMode not applicable to the codex CLI.
   * @returns `ok(ChatResult)` on success, `err(Error)` if the subprocess fails.
   */
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    return ResultAsync.fromPromise(this.chatImpl(prompt, opts), toError)
  }

  /**
   * Wraps the raw codex stdout into the canonical `{ content, usage }` shape.
   * Token usage is always zero.
   *
   * @param raw - Object with a `content` field (the subprocess stdout).
   * @returns `ok({ content, usage })` always.
   */
  protected parseResponse(raw: unknown): Result<{ content: string; usage: TokenUsage }, Error> {
    const r = raw as { content?: string }
    const content = r.content ?? ''
    const usage = toTokenUsage(0, 0, 0)
    logger.debug({ outputLen: content.length }, 'codex response received')
    return ok({ content, usage })
  }
}
