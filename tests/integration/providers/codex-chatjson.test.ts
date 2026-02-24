import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { AuditResponseSchema } from '@/types/schema/audit-schema'

/**
 * Integration tests for CodexAuditProvider.chatJSON.
 *
 * Mock boundary: only execFileNoThrow. The real CodexAuditProvider, real
 * AuditProvider.chatJSON chain, and real Zod schema validation all run.
 */

const execState = {
  stdout: '{"pass":true}',
  stderr: '',
  status: 0
}

mock.module('@/utils/execFileNoThrow', () => ({
  execFileNoThrow: async (_file: string, _args: string[]) => ({
    stdout: execState.stdout,
    stderr: execState.stderr,
    status: execState.status
  })
}))

import { CodexAuditProvider } from '@/providers/codex'
import { defaultConfig } from '@tests/fixtures/provider'

describe('CodexAuditProvider.chatJSON (integration)', () => {
  let provider: CodexAuditProvider

  beforeEach(() => {
    execState.stdout = '{"pass":true}'
    execState.stderr = ''
    execState.status = 0
    provider = new CodexAuditProvider(defaultConfig())
  })

  it('valid JSON → ok({pass:true})', async () => {
    execState.stdout = '{"pass":true}'

    const result = await provider.chatJSON('audit this', AuditResponseSchema)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.pass).toBe(true)
    }
  })

  it('valid JSON with findings → ok({pass:false, findings:[...]})', async () => {
    execState.stdout = JSON.stringify({
      pass: false,
      findings: [
        {
          category: 'failing_check',
          severity: 'error',
          title: 'Tests broken',
          detail: '2 unit tests fail'
        }
      ]
    })

    const result = await provider.chatJSON('audit this', AuditResponseSchema)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.pass).toBe(false)
      if (!result.value.pass) {
        expect(result.value.findings).toHaveLength(1)
        expect(result.value.findings[0].title).toBe('Tests broken')
        expect(result.value.findings[0].category).toBe('failing_check')
      }
    }
  })

  it('invalid JSON → err("codex returned invalid JSON")', async () => {
    execState.stdout = 'not json at all'

    const result = await provider.chatJSON('audit this', AuditResponseSchema)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('codex returned invalid JSON')
    }
  })

  it('valid JSON, wrong schema → err("failed schema validation")', async () => {
    execState.stdout = '{"foo":"bar"}'

    const result = await provider.chatJSON('audit this', AuditResponseSchema)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('failed schema validation')
    }
  })

  it('codex exit code 1 → err before JSON parsing', async () => {
    execState.status = 1
    execState.stderr = 'codex: authentication required'
    // stdout could be valid JSON but we should fail on exit code first
    execState.stdout = '{"pass":true}'

    const result = await provider.chatJSON('audit this', AuditResponseSchema)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('status 1')
    }
  })
})
