import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { ResultAsync } from 'neverthrow'
import { errAsync, okAsync } from 'neverthrow'

// Mock the Claude subprocess layer so tests never spawn a real process
mock.module('@/core/claude', () => ({
  runClaudeIteration: () =>
    ResultAsync.fromSafePromise(Promise.resolve({ outcome: 'success', tokens: 0 })),
  getThreshold: () => 150_000
}))

import { interviewCommand } from '@/cli/commands/interview'
import type { IssueProvider } from '@/core/issue/base'
import type { Issue, Config } from '@/types'
import { ConfigSchema } from '@/types'

const defaultConfig = (): Config => ConfigSchema.parse({})

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: '001',
    title: 'Test issue',
    state: 'NEW',
    parent: '',
    children: [],
    split_count: 0,
    force_split: false,
    body: '## Description\nBuild a widget.',
    ...overrides
  }
}

/** Minimal stub provider for interviewCommand tests. */
function makeProvider(overrides: Partial<IssueProvider> = {}): IssueProvider {
  return {
    listIssues: () => errAsync(new Error('not implemented')),
    fetchIssue: () => errAsync(new Error('not implemented')),
    createIssue: () => errAsync(new Error('not implemented')),
    writeIssue: () => errAsync(new Error('not implemented')),
    deleteIssue: () => errAsync(new Error('not implemented')),
    lockIssue: () => errAsync(new Error('not implemented')),
    unlockIssue: () => errAsync(new Error('not implemented')),
    isLocked: () => errAsync(new Error('not implemented')),
    transition: () => errAsync(new Error('not implemented')),
    autoSelect: () => errAsync(new Error('not implemented')),
    checkAcceptanceCriteria: () => errAsync(new Error('not implemented')),
    ...overrides
  } as unknown as IssueProvider
}

describe('interviewCommand', () => {
  beforeEach(() => {
    process.exitCode = 0
  })

  afterEach(() => {
    process.exitCode = 0
  })

  it('sets exitCode 1 when autoSelect returns err', async () => {
    const provider = makeProvider({
      autoSelect: () => errAsync(new Error('provider error'))
    })

    await interviewCommand(provider, {}, defaultConfig())

    expect(process.exitCode).toBe(1)
  })

  it('does nothing when autoSelect returns null (no NEW issues)', async () => {
    const provider = makeProvider({
      autoSelect: () => okAsync(null)
    })

    await interviewCommand(provider, {}, defaultConfig())

    expect(process.exitCode).toBe(0)
  })

  it('sets exitCode 1 when transition NEW → INTERVIEWING fails', async () => {
    const issue = makeIssue()
    const provider = makeProvider({
      transition: () => errAsync(new Error('transition failed'))
    })

    await interviewCommand(provider, { issue: issue.id }, defaultConfig())

    expect(process.exitCode).toBe(1)
  })

  it('auto-selects a NEW issue when no issue id provided', async () => {
    const issue = makeIssue({ id: '005', state: 'NEW' })
    let transitionTargets: string[] = []

    const provider = makeProvider({
      autoSelect: () => okAsync(issue),
      transition: (_id, to) => {
        transitionTargets.push(to)
        if (to === 'INTERVIEWING') {
          return okAsync(makeIssue({ state: 'INTERVIEWING' }))
        }
        // PLANNED transition after interview loop completes
        return okAsync(makeIssue({ state: 'PLANNED' }))
      },
      // interviewLoop calls fetchIssue internally — mock it
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
      writeIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    await interviewCommand(provider, {}, defaultConfig())

    // First transition should be NEW → INTERVIEWING
    expect(transitionTargets[0]).toBe('INTERVIEWING')
  })

  it('uses provided issue id instead of auto-selecting', async () => {
    const issue = makeIssue({ state: 'NEW' })
    let autoSelectCalled = false
    let transitionCalled = false

    const provider = makeProvider({
      autoSelect: () => {
        autoSelectCalled = true
        return okAsync(null)
      },
      transition: (_id, to) => {
        transitionCalled = true
        if (to === 'INTERVIEWING') {
          return okAsync(makeIssue({ state: 'INTERVIEWING' }))
        }
        // interviewLoop will fail (no Claude) — that's OK for this test
        return errAsync(new Error('PLANNED transition'))
      },
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
      writeIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    await interviewCommand(provider, { issue: issue.id }, defaultConfig())

    expect(autoSelectCalled).toBe(false)
    expect(transitionCalled).toBe(true)
    // exitCode will be 1 because the interview loop can't run Claude in tests — that's acceptable
  })
})

describe('ConfigSchema interviewModel and auditModel', () => {
  it('defaults interviewModel to claude-sonnet-4-6', () => {
    expect(defaultConfig().interviewModel).toBe('claude-sonnet-4-6')
  })

  it('defaults auditModel to claude-opus-4-6', () => {
    expect(defaultConfig().auditModel).toBe('claude-opus-4-6')
  })

  it('accepts custom interviewModel', () => {
    const config = ConfigSchema.parse({ interviewModel: 'claude-haiku-4-5-20251001' })
    expect(config.interviewModel).toBe('claude-haiku-4-5-20251001')
  })
})
