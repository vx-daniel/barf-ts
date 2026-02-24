import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { okAsync, errAsync } from 'neverthrow'
import { mkdtempSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import { auditCommand } from '@/cli/commands/audit'
import { defaultConfig, makeIssue, makeProvider } from '@tests/fixtures/provider'

// Mock audit provider injected via AuditDeps — no module mocking needed
const mockState = {
  isConfigured: true,
  content: '{"pass":true,"findings":[]}',
  error: null as Error | null
}

function makeMockAuditProvider() {
  return {
    name: 'mock',
    isConfigured: () => mockState.isConfigured,
    describe: () => ({
      name: 'mock',
      displayName: 'Mock Provider',
      requiredConfigKeys: ['mockKey'],
      supportedModels: []
    }),
    chatJSON: () => {
      if (mockState.error) return errAsync(mockState.error)
      try {
        return okAsync(JSON.parse(mockState.content))
      } catch {
        return errAsync(new Error('invalid JSON'))
      }
    }
  }
}

describe('auditCommand (full flow)', () => {
  beforeEach(() => {
    process.exitCode = 0
    mockState.isConfigured = true
    mockState.content = '{"pass":true,"findings":[]}'
    mockState.error = null
  })

  afterEach(() => {
    process.exitCode = 0
  })

  it('audits a COMPLETED issue end-to-end (pass)', async () => {
    const dirs = mkdtempSync(join(tmpdir(), 'barf-audit-'))
    const config = {
      ...defaultConfig(),
      openaiApiKey: 'sk-test',
      issuesDir: join(dirs, 'issues'),
      planDir: join(dirs, 'plans')
    }
    mkdirSync(config.issuesDir, { recursive: true })
    mkdirSync(config.planDir, { recursive: true })

    const issue = makeIssue({ id: '001', state: 'COMPLETED' })
    const provider = makeProvider({ fetchIssue: () => okAsync(issue) })

    await auditCommand(provider, { issue: '001', all: false }, config, {
      provider: makeMockAuditProvider() as never
    })

    expect(process.exitCode).toBe(0)
  })

  it('sets exitCode 1 when provider API returns error', async () => {
    mockState.error = new Error('API failure')
    const issue = makeIssue({ id: '001', state: 'COMPLETED' })
    const provider = makeProvider({ fetchIssue: () => okAsync(issue) })
    const config = {
      ...defaultConfig(),
      openaiApiKey: 'sk-test',
      issuesDir: '/tmp/nonexistent-' + Date.now(),
      planDir: '/tmp/nonexistent-plans-' + Date.now()
    }

    await auditCommand(provider, { issue: '001', all: false }, config, {
      provider: makeMockAuditProvider() as never
    })
    expect(process.exitCode).toBe(1)
  })

  it('creates findings issue when audit returns pass=false', async () => {
    mockState.content = JSON.stringify({
      pass: false,
      findings: [
        {
          category: 'failing_check',
          severity: 'error',
          title: 'Tests failing',
          detail: '3 unit tests are broken'
        }
      ]
    })

    const dirs = mkdtempSync(join(tmpdir(), 'barf-audit-findings-'))
    const config = {
      ...defaultConfig(),
      openaiApiKey: 'sk-test',
      issuesDir: join(dirs, 'issues'),
      planDir: join(dirs, 'plans')
    }
    mkdirSync(config.issuesDir, { recursive: true })
    mkdirSync(config.planDir, { recursive: true })

    let createdIssue: { title: string; body?: string; parent?: string } | null = null
    const issue = makeIssue({ id: '001', state: 'COMPLETED', title: 'Add feature X' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      createIssue: (input) => {
        createdIssue = input
        return okAsync(makeIssue({ id: '002', title: input.title }))
      }
    })

    await auditCommand(provider, { issue: '001', all: false }, config, {
      provider: makeMockAuditProvider() as never
    })

    expect(process.exitCode).toBe(1)
    expect(createdIssue).not.toBeNull()
    expect(createdIssue!.title).toBe('Audit findings: Add feature X')
    expect(createdIssue!.parent).toBe('001')
    expect(createdIssue!.body).toContain('Tests failing')
  })

  it('sets exitCode 1 when provider is not configured', async () => {
    mockState.isConfigured = false
    const issue = makeIssue({ id: '001', state: 'COMPLETED' })
    const provider = makeProvider({ fetchIssue: () => okAsync(issue) })
    const config = {
      ...defaultConfig(),
      issuesDir: '/tmp/nonexistent-' + Date.now(),
      planDir: '/tmp/nonexistent-plans-' + Date.now()
    }

    await auditCommand(provider, { issue: '001', all: false }, config, {
      provider: makeMockAuditProvider() as never
    })
    expect(process.exitCode).toBe(1)
  })

  it('sets exitCode 1 when chatJSON returns error (covers JSON/schema failures)', async () => {
    mockState.error = new Error('chat failed')
    const dirs = mkdtempSync(join(tmpdir(), 'barf-audit-err-'))
    const config = {
      ...defaultConfig(),
      openaiApiKey: 'sk-test',
      issuesDir: join(dirs, 'issues'),
      planDir: join(dirs, 'plans')
    }
    mkdirSync(config.issuesDir, { recursive: true })
    mkdirSync(config.planDir, { recursive: true })

    const issue = makeIssue({ id: '001', state: 'COMPLETED' })
    const provider = makeProvider({ fetchIssue: () => okAsync(issue) })

    await auditCommand(provider, { issue: '001', all: false }, config, {
      provider: makeMockAuditProvider() as never
    })
    expect(process.exitCode).toBe(1)
  })
})
