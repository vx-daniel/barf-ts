import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { okAsync } from 'neverthrow'
import { mkdtempSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Controllable mock state — mock at the OpenAI SDK level so @/core/openai wrapper is exercised
const mockState = {
  content: '{"pass":true}',
  error: null as Error | null
}

mock.module('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async () => {
          if (mockState.error) {
            throw mockState.error
          }
          return {
            choices: [{ message: { content: mockState.content } }],
            usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 }
          }
        }
      }
    }

    constructor(_opts: unknown) {
      // no-op
    }
  }
}))

import { auditCommand } from '@/cli/commands/audit'
import { defaultConfig, makeIssue, makeProvider } from '@tests/fixtures/provider'

describe('auditCommand (full flow)', () => {
  beforeEach(() => {
    process.exitCode = 0
    mockState.content = '{"pass":true}'
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
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue)
    })

    await auditCommand(provider, { issue: '001', all: false }, config)

    expect(process.exitCode).toBe(0)
  })

  it('sets exitCode 1 when OpenAI API returns error', async () => {
    mockState.error = new Error('API failure')
    const issue = makeIssue({ id: '001', state: 'COMPLETED' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue)
    })

    const config = {
      ...defaultConfig(),
      openaiApiKey: 'sk-test',
      issuesDir: '/tmp/nonexistent-' + Date.now(),
      planDir: '/tmp/nonexistent-plans-' + Date.now()
    }

    await auditCommand(provider, { issue: '001', all: false }, config)
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

    await auditCommand(provider, { issue: '001', all: false }, config)

    expect(process.exitCode).toBe(1)
    expect(createdIssue).not.toBeNull()
    expect(createdIssue!.title).toBe('Audit findings: Add feature X')
    expect(createdIssue!.parent).toBe('001')
    expect(createdIssue!.body).toContain('Tests failing')
  })

  it('sets exitCode 1 when openaiApiKey is missing', async () => {
    const issue = makeIssue({ id: '001', state: 'COMPLETED' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue)
    })

    const config = {
      ...defaultConfig(),
      // openaiApiKey defaults to '' (empty)
      issuesDir: '/tmp/nonexistent-' + Date.now(),
      planDir: '/tmp/nonexistent-plans-' + Date.now()
    }

    await auditCommand(provider, { issue: '001', all: false }, config)
    expect(process.exitCode).toBe(1)
  })

  it('sets exitCode 1 on malformed JSON response', async () => {
    mockState.content = 'not json at all'

    const dirs = mkdtempSync(join(tmpdir(), 'barf-audit-badjson-'))
    const config = {
      ...defaultConfig(),
      openaiApiKey: 'sk-test',
      issuesDir: join(dirs, 'issues'),
      planDir: join(dirs, 'plans')
    }
    mkdirSync(config.issuesDir, { recursive: true })
    mkdirSync(config.planDir, { recursive: true })

    const issue = makeIssue({ id: '001', state: 'COMPLETED' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue)
    })

    await auditCommand(provider, { issue: '001', all: false }, config)
    expect(process.exitCode).toBe(1)
  })

  it('sets exitCode 1 when JSON does not match schema', async () => {
    mockState.content = '{"pass": false}'

    const dirs = mkdtempSync(join(tmpdir(), 'barf-audit-badschema-'))
    const config = {
      ...defaultConfig(),
      openaiApiKey: 'sk-test',
      issuesDir: join(dirs, 'issues'),
      planDir: join(dirs, 'plans')
    }
    mkdirSync(config.issuesDir, { recursive: true })
    mkdirSync(config.planDir, { recursive: true })

    const issue = makeIssue({ id: '001', state: 'COMPLETED' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue)
    })

    await auditCommand(provider, { issue: '001', all: false }, config)
    expect(process.exitCode).toBe(1)
  })
})
