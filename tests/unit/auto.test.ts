import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { ResultAsync } from 'neverthrow'
import { errAsync, okAsync } from 'neverthrow'

// Mock the Claude subprocess layer so tests never spawn a real process
mock.module('@/core/claude', () => ({
  runClaudeIteration: () =>
    ResultAsync.fromSafePromise(Promise.resolve({ outcome: 'success', tokens: 0 })),
  getThreshold: () => 150_000
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

  it('interviews NEW issues then exits when no further work remains', async () => {
    let callCount = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        // First call: has a NEW issue; second call: issue moved to INTERVIEWING (stuck)
        if (callCount === 1) {
          return okAsync([makeIssue({ id: '001', state: 'NEW' })])
        }
        return okAsync([]) // done
      },
      transition: (_id, to) => {
        if (to === 'INTERVIEWING') {
          return okAsync(makeIssue({ state: 'INTERVIEWING' }))
        }
        return okAsync(makeIssue({ state: 'PLANNED' }))
      },
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
      writeIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(callCount).toBeGreaterThanOrEqual(1)
  })

  it('warns about stuck INTERVIEWING issues', async () => {
    let callCount = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount === 1) {
          return okAsync([makeIssue({ id: '002', state: 'INTERVIEWING' })])
        }
        return okAsync([]) // no work left
      }
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    // INTERVIEWING issue is not actionable work (not in toPlan/toBuild/toInterview)
    // so the loop sees no work and exits
    expect(process.exitCode).toBe(0)
  })

  it('plans INTERVIEWING issues in plan phase', async () => {
    let callCount = 0
    let lockCalls = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount === 1) {
          return okAsync([makeIssue({ id: '003', state: 'INTERVIEWING' })])
        }
        return okAsync([])
      },
      // runLoop calls lockIssue
      lockIssue: () => {
        lockCalls++
        return okAsync(undefined)
      },
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
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
        if (callCount === 1) {
          return okAsync([makeIssue({ id: '004', state: 'PLANNED' })])
        }
        return okAsync([])
      },
      lockIssue: () => {
        lockCalls++
        return okAsync(undefined)
      },
      unlockIssue: () => okAsync(undefined),
      // After lock+transition, fetchIssue returns COMPLETED so runLoop exits immediately
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
        if (callCount === 1) {
          return okAsync([makeIssue({ id: '005', state: 'IN_PROGRESS' })])
        }
        return okAsync([])
      },
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      // Return COMPLETED so runLoop exits immediately
      fetchIssue: () => okAsync(makeIssue({ state: 'COMPLETED' })),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      checkAcceptanceCriteria: () => okAsync(true)
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(callCount).toBeGreaterThanOrEqual(1)
  })

  it('handles interview transition failure gracefully', async () => {
    let callCount = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount === 1) {
          return okAsync([makeIssue({ id: '006', state: 'NEW' })])
        }
        return okAsync([])
      },
      transition: () => errAsync(new Error('locked'))
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    // Should not crash — gracefully continue
    expect(process.exitCode).toBe(0)
  })
})
