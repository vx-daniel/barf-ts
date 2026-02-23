import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { ResultAsync } from 'neverthrow'
import { errAsync, okAsync } from 'neverthrow'

// Mock the Claude subprocess layer so tests never spawn a real process
mock.module('@/core/claude', () => ({
  runClaudeIteration: () =>
    ResultAsync.fromSafePromise(Promise.resolve({ outcome: 'success', tokens: 0 })),
  getThreshold: () => 150_000
}))

// Mock triage so auto tests don't need a real claude binary
mock.module('@/core/triage', () => ({
  triageIssue: () => okAsync(undefined)
}))

import { autoCommand } from '@/cli/commands/auto'
import { defaultConfig, makeIssue, makeProvider } from '@tests/fixtures/provider'

describe('autoCommand', () => {
  beforeEach(() => {
    process.exitCode = 0
  })

  afterEach(() => {
    process.exitCode = 0
  })

  it('sets exitCode 1 when listIssues() returns err', async () => {
    const provider = makeProvider({
      listIssues: () => errAsync(new Error('gh: not authenticated'))
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(process.exitCode).toBe(1)
  })

  it('does not set exitCode when list is empty', async () => {
    const provider = makeProvider({
      listIssues: () => okAsync([])
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(process.exitCode).toBe(0)
  })

  it('does not set exitCode when all issues are in non-actionable states', async () => {
    const provider = makeProvider({
      listIssues: () => okAsync([makeIssue({ state: 'COMPLETED' })])
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(process.exitCode).toBe(0)
  })

  it('exits when only needs_interview=true NEW issues remain', async () => {
    const provider = makeProvider({
      listIssues: () =>
        okAsync([makeIssue({ id: '001', state: 'NEW', needs_interview: true })])
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    // No plannable work — exits cleanly (exitCode stays 0)
    expect(process.exitCode).toBe(0)
  })

  it('plans NEW issues with needs_interview=false', async () => {
    let callCount = 0
    let lockCalls = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount <= 2) {
          return okAsync([makeIssue({ id: '003', state: 'NEW', needs_interview: false })])
        }
        return okAsync([])
      },
      lockIssue: () => {
        lockCalls++
        return okAsync(undefined)
      },
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'NEW', needs_interview: false })),
      writeIssue: () => okAsync(makeIssue({ state: 'PLANNED' })),
      transition: () => okAsync(makeIssue({ state: 'PLANNED' })),
      checkAcceptanceCriteria: () => okAsync(false)
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(lockCalls).toBeGreaterThanOrEqual(1)
  })

  it('plans NEW issues with needs_interview=undefined (backward compat)', async () => {
    let callCount = 0
    let lockCalls = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        // needs_interview=undefined treated same as false for planning
        if (callCount <= 2) {
          return okAsync([makeIssue({ id: '004', state: 'NEW' })])
        }
        return okAsync([])
      },
      lockIssue: () => {
        lockCalls++
        return okAsync(undefined)
      },
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'NEW' })),
      writeIssue: () => okAsync(makeIssue({ state: 'PLANNED' })),
      transition: () => okAsync(makeIssue({ state: 'PLANNED' })),
      checkAcceptanceCriteria: () => okAsync(false)
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(lockCalls).toBeGreaterThanOrEqual(1)
  })

  it('builds PLANNED issues in build phase', async () => {
    let callCount = 0
    let lockCalls = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount <= 2) {
          return okAsync([makeIssue({ id: '005', state: 'PLANNED' })])
        }
        return okAsync([])
      },
      lockIssue: () => {
        lockCalls++
        return okAsync(undefined)
      },
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'COMPLETED' })),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      checkAcceptanceCriteria: () => okAsync(true)
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(lockCalls).toBeGreaterThanOrEqual(1)
  })

  it('builds IN_PROGRESS issues', async () => {
    let callCount = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount <= 2) {
          return okAsync([makeIssue({ id: '006', state: 'IN_PROGRESS' })])
        }
        return okAsync([])
      },
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'COMPLETED' })),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      checkAcceptanceCriteria: () => okAsync(true)
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(callCount).toBeGreaterThanOrEqual(1)
  })

  it('sets exitCode 1 when second listIssues() (post-triage refresh) returns err', async () => {
    let callCount = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount === 1) {
          return okAsync([]) // first call — no untriaged NEW issues
        }
        return errAsync(new Error('network error'))
      }
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(process.exitCode).toBe(1)
  })
})
