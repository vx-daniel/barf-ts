import { AuditProvider } from '@/providers/base'
import { OpenAIAuditProvider } from '@/providers/openai'
import { GeminiAuditProvider } from '@/providers/gemini'
import { ClaudeAuditProvider } from '@/providers/claude'
import { CodexAuditProvider } from '@/providers/codex'
import type { Config } from '@/types'

export { AuditProvider }
export { OpenAIAuditProvider }
export { GeminiAuditProvider }
export { ClaudeAuditProvider }
export { CodexAuditProvider }
export type {
  ChatResult,
  ChatOptions,
  PingResult,
  ProviderInfo,
} from '@/providers/base'

/**
 * Creates the configured {@link AuditProvider} implementation.
 *
 * Reads `config.auditProvider` to select the provider. Defaults to OpenAI.
 * To add a new provider, create a class extending {@link AuditProvider} and add a case here.
 *
 * @param config - Loaded barf configuration.
 * @returns The appropriate {@link AuditProvider} instance.
 */
export function createAuditProvider(config: Config): AuditProvider {
  switch (config.auditProvider) {
    case 'gemini':
      return new GeminiAuditProvider(config)
    case 'claude':
      return new ClaudeAuditProvider(config)
    case 'codex':
      return new CodexAuditProvider(config)
    default:
      return new OpenAIAuditProvider(config)
  }
}
