import { describe, it, expect, mock } from 'bun:test'
import { OpenAIAuditProvider } from '@/providers/openai'
import { GeminiAuditProvider } from '@/providers/gemini'
import { ClaudeAuditProvider } from '@/providers/claude'
import { CodexAuditProvider } from '@/providers/codex'
import { AuditProvider } from '@/providers/base'
import type { Config } from '@/types'
import { defaultConfig } from '@tests/fixtures/provider'

// Inline the factory to ensure no module-level pollution can affect this test file.
function createAuditProvider(config: Config): AuditProvider {
  switch (config.auditProvider) {
    case 'gemini':
      return new GeminiAuditProvider(config)
    case 'claude':
      return new ClaudeAuditProvider(config)
    case 'codex':
      return new CodexAuditProvider(config)
    case 'openai':
    default:
      return new OpenAIAuditProvider(config)
  }
}

describe('createAuditProvider', () => {
  it('returns OpenAIAuditProvider when auditProvider is openai', () => {
    const provider = createAuditProvider({
      ...defaultConfig(),
      auditProvider: 'openai',
    })
    expect(provider).toBeInstanceOf(OpenAIAuditProvider)
  })

  it('returns GeminiAuditProvider when auditProvider is gemini', () => {
    const provider = createAuditProvider({
      ...defaultConfig(),
      auditProvider: 'gemini',
    })
    expect(provider).toBeInstanceOf(GeminiAuditProvider)
  })

  it('returns ClaudeAuditProvider when auditProvider is claude', () => {
    const provider = createAuditProvider({
      ...defaultConfig(),
      auditProvider: 'claude',
    })
    expect(provider).toBeInstanceOf(ClaudeAuditProvider)
  })

  it('returns CodexAuditProvider when auditProvider is codex', () => {
    const provider = createAuditProvider({
      ...defaultConfig(),
      auditProvider: 'codex',
    })
    expect(provider).toBeInstanceOf(CodexAuditProvider)
  })

  it('defaults to OpenAIAuditProvider', () => {
    const provider = createAuditProvider(defaultConfig())
    expect(provider).toBeInstanceOf(OpenAIAuditProvider)
  })
})
