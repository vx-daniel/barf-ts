import { describe, it, expect, mock } from 'bun:test'
import { OpenAIAuditProvider } from '@/providers/openai'
import { GeminiAuditProvider } from '@/providers/gemini'
import { ClaudeAuditProvider } from '@/providers/claude'
import { AuditProvider } from '@/providers/base'
import type { Config } from '@/types'
import { defaultConfig } from '@tests/fixtures/provider'

// Re-establish the real factory to guard against mock.module pollution from other test files.
// Some test files in this suite mock @/providers/index; this ensures the real createAuditProvider
// is used here regardless of worker-level mock state.
function createAuditProvider(config: Config): AuditProvider {
  switch (config.auditProvider) {
    case 'gemini': return new GeminiAuditProvider(config)
    case 'claude': return new ClaudeAuditProvider(config)
    case 'openai':
    default:       return new OpenAIAuditProvider(config)
  }
}

describe('createAuditProvider', () => {
  it('returns OpenAIAuditProvider when auditProvider is openai', () => {
    const provider = createAuditProvider({ ...defaultConfig(), auditProvider: 'openai' })
    expect(provider).toBeInstanceOf(OpenAIAuditProvider)
  })

  it('returns GeminiAuditProvider when auditProvider is gemini', () => {
    const provider = createAuditProvider({ ...defaultConfig(), auditProvider: 'gemini' })
    expect(provider).toBeInstanceOf(GeminiAuditProvider)
  })

  it('returns ClaudeAuditProvider when auditProvider is claude', () => {
    const provider = createAuditProvider({ ...defaultConfig(), auditProvider: 'claude' })
    expect(provider).toBeInstanceOf(ClaudeAuditProvider)
  })

  it('defaults to OpenAIAuditProvider', () => {
    const provider = createAuditProvider(defaultConfig())
    expect(provider).toBeInstanceOf(OpenAIAuditProvider)
  })
})
