import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { ResultAsync } from 'neverthrow'
import { errAsync, okAsync } from 'neverthrow'

import { autoCommand } from '@/cli/commands/auto'
import {
  defaultConfig,
  makeIssue,
  makeProvider,
} from '@tests/fixtures/provider'

const mockTriageIssue = () => okAsync(undefined)
const mockVerifyIssue = () => okAsync(undefined)

const mockRunClaudeIteration = () =>
  ResultAsync.fromSafePromise(
    Promise.resolve({ outcome: 'success', tokens: 0, outputTokens: 0 }),
  )

const deps = {
  triageIssue: mockTriageIssue as never,
  runClaudeIteration: mockRunClaudeIteration as never,
  verifyIssue: mockVerifyIssue as never,
}

describe('autoCommand', () => {
  beforeEach(() => {
    process.exitCode = 0
  })

  afterEach(() => {
    process.exitCode = 0
  })

  it('sets exitCode 1 when listIssues() returns err', async () => {
    const provider = makeProvider({
      listIssues: () => errAsync(new Error('gh: not authenticated')),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

    expect(process.exitCode).toBe(1)
  })

  it('does not set exitCode when list is empty', async () => {
    const provider = makeProvider({
      listIssues: () => okAsync([]),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

    expect(process.exitCode).toBe(0)
  })

  it('does not set exitCode when all issues are in non-actionable states', async () => {
    const provider = makeProvider({
      listIssues: () => okAsync([makeIssue({ state: 'COMPLETED' })]),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

    expect(process.exitCode).toBe(0)
  })

  it('exits when only needs_interview=true NEW issues remain', async () => {
    const provider = makeProvider({
      listIssues: () =>
        okAsync([
          makeIssue({ id: '001', state: 'NEW', needs_interview: true }),
        ]),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

    // No plannable work — exits cleanly (exitCode stays 0)
    expect(process.exitCode).toBe(0)
  })

  it('plans GROOMED issues', async () => {
    let callCount = 0
    let lockCalls = 0
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount <= 2) {
          return okAsync([
            makeIssue({ id: '003', state: 'GROOMED', needs_interview: false }),
          ])
        }
        return okAsync([])
      },
      lockIssue: () => {
        lockCalls++
        return okAsync(undefined)
      },
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () =>
        okAsync(makeIssue({ state: 'GROOMED', needs_interview: false })),
      writeIssue: () => okAsync(makeIssue({ state: 'PLANNED' })),
      transition: () => okAsync(makeIssue({ state: 'PLANNED' })),
      checkAcceptanceCriteria: () => okAsync(false),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

    expect(lockCalls).toBeGreaterThanOrEqual(1)
  })

  it('does not plan NEW issues (must be GROOMED first)', async () => {
    const provider = makeProvider({
      listIssues: () =>
        okAsync([
          makeIssue({ id: '004', state: 'NEW', needs_interview: false }),
        ]),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

    // NEW issues are not plannable — exits cleanly
    expect(process.exitCode).toBe(0)
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
      checkAcceptanceCriteria: () => okAsync(true),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

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
      checkAcceptanceCriteria: () => okAsync(true),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

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
      },
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), deps)

    expect(process.exitCode).toBe(1)
  })

  // ── Verify phase ────────────────────────────────────────────────────────

  it('includes COMPLETED issues with verify_count>0 in toVerify', async () => {
    let verifyCalledFor: string[] = []
    const mockVerify = (id: string) => {
      verifyCalledFor.push(id)
      return okAsync(undefined)
    }
    let callCount = 0
    // Issue is COMPLETED with verify_count=1 (has been attempted before) — needs re-verify
    const completedIssue = makeIssue({
      id: '007',
      state: 'COMPLETED',
      verify_count: 1,
      children: [],
    })
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount <= 2) {
          return okAsync([completedIssue])
        }
        return okAsync([]) // second loop: empty → exit
      },
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), {
      ...deps,
      verifyIssue: mockVerify as never,
    })

    expect(verifyCalledFor).toContain('007')
  })

  it('excludes COMPLETED issues with verify_exhausted=true from toVerify', async () => {
    let verifyCalled = false
    const mockVerify = () => {
      verifyCalled = true
      return okAsync(undefined)
    }
    const exhaustedIssue = makeIssue({
      id: '008',
      state: 'COMPLETED',
      verify_count: 3,
      verify_exhausted: true,
      children: [],
    })
    const provider = makeProvider({
      listIssues: () => okAsync([exhaustedIssue]),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), {
      ...deps,
      verifyIssue: mockVerify as never,
    })

    expect(verifyCalled).toBe(false)
  })

  it('excludes is_verify_fix=true issues from toVerify', async () => {
    let verifyCalled = false
    const mockVerify = () => {
      verifyCalled = true
      return okAsync(undefined)
    }
    const fixIssue = makeIssue({
      id: '009',
      state: 'COMPLETED',
      verify_count: 1,
      is_verify_fix: true,
      children: [],
    })
    const provider = makeProvider({
      listIssues: () => okAsync([fixIssue]),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), {
      ...deps,
      verifyIssue: mockVerify as never,
    })

    expect(verifyCalled).toBe(false)
  })

  it('skips verify for issue whose fix children are not yet done', async () => {
    let verifyCalled = false
    const mockVerify = () => {
      verifyCalled = true
      return okAsync(undefined)
    }
    // Parent has a fix child that is still IN_PROGRESS
    const fixChild = makeIssue({
      id: '010-1',
      state: 'IN_PROGRESS',
      is_verify_fix: true,
    })
    const parentIssue = makeIssue({
      id: '010',
      state: 'COMPLETED',
      verify_count: 1,
      children: ['010-1'],
    })
    let callCount = 0
    const provider = makeProvider({
      // After 2 calls (one triage + one refresh), return empty so loop exits
      listIssues: () => {
        callCount++
        if (callCount <= 2) return okAsync([parentIssue])
        return okAsync([])
      },
      fetchIssue: () => okAsync(fixChild),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), {
      ...deps,
      verifyIssue: mockVerify as never,
    })

    expect(verifyCalled).toBe(false)
  })

  it('runs verify for issue whose fix children are all done', async () => {
    let verifyCalledFor: string[] = []
    const mockVerify = (id: string) => {
      verifyCalledFor.push(id)
      return okAsync(undefined)
    }
    let callCount = 0
    const fixChild = makeIssue({
      id: '011-1',
      state: 'COMPLETED',
      is_verify_fix: true,
    })
    const parentIssue = makeIssue({
      id: '011',
      state: 'COMPLETED',
      verify_count: 1,
      children: ['011-1'],
    })
    const provider = makeProvider({
      listIssues: () => {
        callCount++
        if (callCount <= 2) return okAsync([parentIssue])
        return okAsync([])
      },
      fetchIssue: () => okAsync(fixChild),
    })

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig(), {
      ...deps,
      verifyIssue: mockVerify as never,
    })

    expect(verifyCalledFor).toContain('011')
  })
})
