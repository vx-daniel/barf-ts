import { describe, it, expect, beforeEach } from 'bun:test'
import { ResultAsync } from 'neverthrow'
import { okAsync, errAsync } from 'neverthrow'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import { runLoop } from '@/core/batch'
import type { Config, Issue } from '@/types'
import {
  defaultConfig,
  makeIssue,
  makeProvider,
} from '@tests/fixtures/provider'
import { serializeIssue } from '@/core/issue'

const mockVerifyIssue = () => okAsync(undefined)
const mockRunPreComplete = () =>
  ResultAsync.fromSafePromise(Promise.resolve({ passed: true } as const))

// Controllable mock: reassign `mockOutcomes` to control runClaudeIteration per-test
// Each call pops the first element; once empty, repeats the last.
let mockOutcomes: Array<{
  outcome: string
  tokens: number
  outputTokens: number
  rateLimitResetsAt?: number
}> = [{ outcome: 'success', tokens: 100, outputTokens: 10 }]
let mockIterationErr: Error | null = null

function nextOutcome(): {
  outcome: string
  tokens: number
  outputTokens: number
  rateLimitResetsAt?: number
} {
  if (mockOutcomes.length > 1) {
    return mockOutcomes.shift()!
  }
  return mockOutcomes[0]
}

function mockRunClaudeIteration() {
  if (mockIterationErr) {
    return ResultAsync.fromPromise(
      Promise.reject(mockIterationErr),
      (e) => e as Error,
    )
  }
  return ResultAsync.fromSafePromise(Promise.resolve(nextOutcome()))
}

function makeTmpDirs(): {
  issuesDir: string
  barfDir: string
  planDir: string
} {
  const root = mkdtempSync(join(tmpdir(), 'barf-batch-'))
  const issuesDir = join(root, 'issues')
  const barfDir = join(root, '.barf')
  const planDir = join(root, 'plans')
  mkdirSync(issuesDir, { recursive: true })
  mkdirSync(barfDir, { recursive: true })
  mkdirSync(planDir, { recursive: true })
  return { issuesDir, barfDir, planDir }
}

function writeIssueFile(issuesDir: string, issue: Issue): void {
  writeFileSync(join(issuesDir, `${issue.id}.md`), serializeIssue(issue))
}

const deps = {
  runClaudeIteration: mockRunClaudeIteration as never,
  verifyIssue: mockVerifyIssue as never,
  runPreComplete: mockRunPreComplete as never,
}

describe('runLoop', () => {
  beforeEach(() => {
    mockOutcomes = [{ outcome: 'success', tokens: 100, outputTokens: 10 }]
    mockIterationErr = null
  })

  // ── Plan mode ──────────────────────────────────────────────────────────────

  describe('plan mode', () => {
    it('runs single iteration and exits', async () => {
      let lockCalls = 0
      let unlockCalls = 0
      const issue = makeIssue({ id: '001', state: 'NEW' })
      const provider = makeProvider({
        lockIssue: () => {
          lockCalls++
          return okAsync(undefined)
        },
        unlockIssue: () => {
          unlockCalls++
          return okAsync(undefined)
        },
        fetchIssue: () => okAsync(issue),
      })

      const result = await runLoop(
        '001',
        'plan',
        defaultConfig(),
        provider,
        deps,
      )

      expect(result.isOk()).toBe(true)
      expect(lockCalls).toBe(1)
      expect(unlockCalls).toBe(1)
    })

    it('transitions to PLANNED when plan file exists', async () => {
      const dirs = makeTmpDirs()
      const issue = makeIssue({ id: '001', state: 'NEW' })
      writeIssueFile(dirs.issuesDir, issue)

      // Create a plan file so plan mode detects it
      writeFileSync(join(dirs.planDir, '001.md'), '# Plan')

      let transitionTarget = ''
      const provider = makeProvider({
        lockIssue: () => okAsync(undefined),
        unlockIssue: () => okAsync(undefined),
        fetchIssue: () => okAsync(issue),
        transition: (_id, to) => {
          transitionTarget = to
          return okAsync(makeIssue({ state: to }))
        },
      })

      const config = {
        ...defaultConfig(),
        issuesDir: dirs.issuesDir,
        planDir: dirs.planDir,
      }
      const result = await runLoop('001', 'plan', config, provider, deps)

      expect(result.isOk()).toBe(true)
      expect(transitionTarget).toBe('PLANNED')
    })
  })

  // ── Build mode ─────────────────────────────────────────────────────────────

  describe('build mode', () => {
    it('transitions to IN_PROGRESS on first iteration', async () => {
      let transitionTargets: string[] = []
      const issue = makeIssue({ id: '001', state: 'PLANNED' })
      const provider = makeProvider({
        lockIssue: () => okAsync(undefined),
        unlockIssue: () => okAsync(undefined),
        fetchIssue: () => okAsync(makeIssue({ state: 'COMPLETED' })),
        transition: (_id, to) => {
          transitionTargets.push(to)
          return okAsync(makeIssue({ state: to }))
        },
        writeIssue: () => okAsync(issue),
        checkAcceptanceCriteria: () => okAsync(false),
      })

      // Return PLANNED on first fetch (for transition check), COMPLETED on iteration fetch
      let fetchCount = 0
      provider.fetchIssue = () => {
        fetchCount++
        if (fetchCount <= 2) {
          return okAsync(makeIssue({ state: 'PLANNED' }))
        }
        return okAsync(makeIssue({ state: 'COMPLETED' }))
      }

      const result = await runLoop(
        '001',
        'build',
        defaultConfig(),
        provider,
        deps,
      )
      expect(result.isOk()).toBe(true)
      expect(transitionTargets).toContain('IN_PROGRESS')
    })

    it('breaks loop when issue is COMPLETED', async () => {
      const provider = makeProvider({
        lockIssue: () => okAsync(undefined),
        unlockIssue: () => okAsync(undefined),
        fetchIssue: () => okAsync(makeIssue({ state: 'COMPLETED' })),
      })

      const result = await runLoop(
        '001',
        'build',
        defaultConfig(),
        provider,
        deps,
      )
      expect(result.isOk()).toBe(true)
    })

    it('checks acceptance criteria and transitions to COMPLETED', async () => {
      let fetchCount = 0
      let transitionTargets: string[] = []
      const provider = makeProvider({
        lockIssue: () => okAsync(undefined),
        unlockIssue: () => okAsync(undefined),
        fetchIssue: () => {
          fetchCount++
          if (fetchCount <= 3) {
            return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
          }
          return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
        },
        transition: (_id, to) => {
          transitionTargets.push(to)
          return okAsync(makeIssue({ state: to }))
        },
        checkAcceptanceCriteria: () => okAsync(true),
        writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      })

      const result = await runLoop(
        '001',
        'build',
        defaultConfig(),
        provider,
        deps,
      )
      expect(result.isOk()).toBe(true)
      expect(transitionTargets).toContain('COMPLETED')
    })

    it('continues when acceptance criteria not met', async () => {
      let fetchCount = 0
      const config = { ...defaultConfig(), maxIterations: 2 }
      const provider = makeProvider({
        lockIssue: () => okAsync(undefined),
        unlockIssue: () => okAsync(undefined),
        fetchIssue: () => {
          fetchCount++
          return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
        },
        transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
        checkAcceptanceCriteria: () => okAsync(false),
        writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      })

      const result = await runLoop('001', 'build', config, provider, deps)
      expect(result.isOk()).toBe(true)
      // Should have iterated (fetchCount > build-mode setup fetches)
      expect(fetchCount).toBeGreaterThan(2)
    })

    it('runs test command when criteria met and testCommand configured', async () => {
      let fetchCount = 0
      let transitionTargets: string[] = []
      const config = { ...defaultConfig(), testCommand: 'true' }
      const provider = makeProvider({
        lockIssue: () => okAsync(undefined),
        unlockIssue: () => okAsync(undefined),
        fetchIssue: () => {
          fetchCount++
          return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
        },
        transition: (_id, to) => {
          transitionTargets.push(to)
          return okAsync(makeIssue({ state: to }))
        },
        checkAcceptanceCriteria: () => okAsync(true),
        writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      })

      const result = await runLoop('001', 'build', config, provider, deps)
      expect(result.isOk()).toBe(true)
      expect(transitionTargets).toContain('COMPLETED')
    })

    it('continues build when tests fail', async () => {
      const config = {
        ...defaultConfig(),
        testCommand: 'false',
        maxIterations: 1,
      }
      const provider = makeProvider({
        lockIssue: () => okAsync(undefined),
        unlockIssue: () => okAsync(undefined),
        fetchIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
        transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
        checkAcceptanceCriteria: () => okAsync(true),
        writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      })

      const result = await runLoop('001', 'build', config, provider, deps)
      expect(result.isOk()).toBe(true)
    })
  })

  // ── Lock failure ──────────────────────────────────────────────────────

  it('returns err when lockIssue fails', async () => {
    const provider = makeProvider({
      lockIssue: () => errAsync(new Error('already locked')),
    })

    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      deps,
    )
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('already locked')
  })

  // ── Outcome: error ─────────────────────────────────────────────────────

  it('stops loop on error outcome', async () => {
    mockOutcomes = [{ outcome: 'error', tokens: 50, outputTokens: 5 }]
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      deps,
    )
    expect(result.isOk()).toBe(true) // error outcome breaks loop but doesn't fail
  })

  // ── Outcome: rate_limited ──────────────────────────────────────────────

  it('returns err on rate_limited outcome', async () => {
    mockOutcomes = [
      { outcome: 'rate_limited', tokens: 50, outputTokens: 5, rateLimitResetsAt: 1700000000 },
    ]
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      deps,
    )
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('Rate limited')
  })

  // ── Outcome: overflow → split ──────────────────────────────────────────

  it('handles overflow by entering split mode', async () => {
    let fetchCount = 0
    let transitionTargets: string[] = []
    // First call returns overflow, second returns success (for split iteration)
    mockOutcomes = [
      { outcome: 'overflow', tokens: 150_000, outputTokens: 1000 },
      { outcome: 'success', tokens: 100, outputTokens: 10 },
    ]
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => {
        fetchCount++
        if (fetchCount <= 5) {
          return okAsync(makeIssue({ state: 'IN_PROGRESS', split_count: 0 }))
        }
        if (fetchCount === 6) {
          return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
        }
        return okAsync(makeIssue({ state: 'SPLIT', children: [] }))
      },
      transition: (_id, to) => {
        transitionTargets.push(to)
        return okAsync(makeIssue({ state: to }))
      },
      writeIssue: () =>
        okAsync(makeIssue({ state: 'IN_PROGRESS', split_count: 1 })),
    })

    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      deps,
    )
    expect(result.isOk()).toBe(true)
    expect(transitionTargets).toContain('SPLIT')
  })

  // ── Outcome: overflow → escalate ───────────────────────────────────────

  it('escalates when split count exceeds maxAutoSplits', async () => {
    // overflow → escalate changes model, then continues. Second iteration returns error to stop.
    mockOutcomes = [
      { outcome: 'overflow', tokens: 150_000, outputTokens: 1000 },
      { outcome: 'error', tokens: 100 },
    ]
    const config = { ...defaultConfig(), maxAutoSplits: 0 }
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () =>
        okAsync(makeIssue({ state: 'IN_PROGRESS', split_count: 5 })),
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    const result = await runLoop('001', 'build', config, provider, deps)
    expect(result.isOk()).toBe(true) // error outcome breaks loop gracefully
  })

  // ── force_split ─────────────────────────────────────────────────────

  it('enters split flow immediately on force_split', async () => {
    mockOutcomes = [{ outcome: 'success', tokens: 100, outputTokens: 10 }]
    let transitionTargets: string[] = []
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () =>
        okAsync(
          makeIssue({
            state: 'IN_PROGRESS',
            force_split: true,
            split_count: 0,
          }),
        ),
      transition: (_id, to) => {
        transitionTargets.push(to)
        return okAsync(makeIssue({ state: to }))
      },
      writeIssue: () =>
        okAsync(
          makeIssue({
            state: 'IN_PROGRESS',
            force_split: false,
            split_count: 1,
          }),
        ),
    })

    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      deps,
    )
    expect(result.isOk()).toBe(true)
    expect(transitionTargets).toContain('SPLIT')
  })

  // ── force_split with escalate ─────────────────────────────────────

  it('escalates on force_split when split_count >= maxAutoSplits', async () => {
    mockOutcomes = [{ outcome: 'success', tokens: 100, outputTokens: 10 }]
    const config = { ...defaultConfig(), maxAutoSplits: 0, maxIterations: 1 }
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () =>
        okAsync(
          makeIssue({
            state: 'IN_PROGRESS',
            force_split: true,
            split_count: 5,
          }),
        ),
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    const result = await runLoop('001', 'build', config, provider, deps)
    expect(result.isOk()).toBe(true)
  })

  // ── Split with children → planSplitChildren ────────────────────────

  it('plans split children after split completes', async () => {
    mockOutcomes = [{ outcome: 'success', tokens: 100, outputTokens: 10 }]
    let fetchCount = 0
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: (id) => {
        fetchCount++
        // Build mode setup: returns force_split so we enter split flow
        if (fetchCount <= 2) {
          return okAsync(
            makeIssue({
              id,
              state: 'IN_PROGRESS',
              force_split: true,
              split_count: 0,
            }),
          )
        }
        // After split iteration: issue in SPLIT state with children
        if (id === '001') {
          return okAsync(
            makeIssue({
              id,
              state: 'SPLIT',
              children: ['002', '003'],
              split_count: 1,
            }),
          )
        }
        // Child issues
        return okAsync(makeIssue({ id, state: 'NEW' }))
      },
      transition: () => okAsync(makeIssue({ state: 'SPLIT' })),
      writeIssue: () =>
        okAsync(makeIssue({ state: 'IN_PROGRESS', split_count: 1 })),
    })

    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      deps,
    )
    expect(result.isOk()).toBe(true)
  })

  // ── verifyIssue called after COMPLETED ────────────────────────────

  it('calls verifyIssue after transitioning to COMPLETED', async () => {
    let verifyIssueCalled = false
    const mockVerifyIssue = () => {
      verifyIssueCalled = true
      return ResultAsync.fromSafePromise(Promise.resolve(undefined))
    }
    let fetchCount = 0
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => {
        fetchCount++
        return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
      },
      transition: (_id, to) => okAsync(makeIssue({ state: to })),
      checkAcceptanceCriteria: () => okAsync(true),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    const depsWithVerify = {
      runClaudeIteration: mockRunClaudeIteration as never,
      verifyIssue: mockVerifyIssue as never,
    }
    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      depsWithVerify,
    )
    expect(result.isOk()).toBe(true)
    expect(verifyIssueCalled).toBe(true)
  })

  it('logs warning but continues when verifyIssue returns err', async () => {
    const mockVerifyIssue = () =>
      ResultAsync.fromSafePromise(Promise.resolve(undefined)).andThen(
        () =>
          // hack: wrap err
          Promise.resolve(undefined) as never,
      )
    const mockVerifyErr = () => errAsync(new Error('verify io error'))

    let fetchCount = 0
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => {
        fetchCount++
        return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
      },
      transition: (_id, to) => okAsync(makeIssue({ state: to })),
      checkAcceptanceCriteria: () => okAsync(true),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    const depsWithErr = {
      runClaudeIteration: mockRunClaudeIteration as never,
      verifyIssue: mockVerifyErr as never,
    }
    // Should still complete without throwing
    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      depsWithErr,
    )
    expect(result.isOk()).toBe(true)
  })

  // ── runClaudeIteration returns err ────────────────────────────────

  it('returns err when runClaudeIteration fails', async () => {
    mockIterationErr = new Error('spawn failed')
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      deps,
    )
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('spawn failed')
  })

  // ── fetchIssue fails in iteration loop ────────────────────────────

  it('returns err when fetchIssue fails during iteration', async () => {
    let fetchCount = 0
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => {
        fetchCount++
        // First 2 fetches succeed (build mode setup), third fails (iteration loop)
        if (fetchCount <= 2) {
          return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
        }
        return errAsync(new Error('disk error'))
      },
      transition: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    const result = await runLoop(
      '001',
      'build',
      defaultConfig(),
      provider,
      deps,
    )
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('disk error')
  })

  // ── Stats persisted on single-iteration build ─────────────────────

  it('persists stats when build completes in one iteration', async () => {
    mockOutcomes = [{ outcome: 'success', tokens: 250, outputTokens: 42 }]
    let writeIssueCalls: Array<Record<string, unknown>> = []
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () =>
        okAsync(makeIssue({ state: 'IN_PROGRESS', total_input_tokens: 0, total_output_tokens: 0, total_iterations: 0, run_count: 0 })),
      transition: (_id, to) => okAsync(makeIssue({ state: to })),
      checkAcceptanceCriteria: () => okAsync(true),
      writeIssue: (_id, patch) => {
        writeIssueCalls.push(patch as Record<string, unknown>)
        return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
      },
    })

    const result = await runLoop('001', 'build', defaultConfig(), provider, deps)
    expect(result.isOk()).toBe(true)

    const statsPatch = writeIssueCalls.find(
      (p) => 'run_count' in p,
    )
    expect(statsPatch).toBeDefined()
    expect(statsPatch!['total_input_tokens']).toBe(250)
    expect(statsPatch!['run_count']).toBe(1)
    expect(statsPatch!['total_iterations']).toBe(1)
  })

  // ── Pre-complete integration ──────────────────────────────────────

  it('runs pre-complete before COMPLETED transition', async () => {
    let preCompleteRan = false
    const customDeps = {
      ...deps,
      runPreComplete: () => {
        preCompleteRan = true
        return ResultAsync.fromSafePromise(Promise.resolve({ passed: true } as const))
      },
    }
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      transition: () => okAsync(makeIssue({ state: 'COMPLETED' })),
      checkAcceptanceCriteria: () => okAsync(true),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    await runLoop('001', 'build', defaultConfig(), provider, customDeps)
    expect(preCompleteRan).toBe(true)
  })

  it('continues loop when pre-complete test gate fails', async () => {
    const config = { ...defaultConfig(), maxIterations: 1, testCommand: 'bun test' }
    const customDeps = {
      ...deps,
      runPreComplete: () =>
        ResultAsync.fromSafePromise(
          Promise.resolve({
            passed: false as const,
            testFailure: { stdout: '', stderr: 'fail', exitCode: 1 },
          }),
        ),
    }
    let transitionTargets: string[] = []
    const provider = makeProvider({
      lockIssue: () => okAsync(undefined),
      unlockIssue: () => okAsync(undefined),
      fetchIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
      transition: (_id: string, to: string) => {
        transitionTargets.push(to)
        return okAsync(makeIssue({ state: to as any }))
      },
      checkAcceptanceCriteria: () => okAsync(true),
      writeIssue: () => okAsync(makeIssue({ state: 'IN_PROGRESS' })),
    })

    await runLoop('001', 'build', config, provider, customDeps)
    expect(transitionTargets).not.toContain('COMPLETED')
  })
})
