import { describe, it, expect } from 'bun:test'
import { okAsync, errAsync } from 'neverthrow'

import {
  runVerification,
  verifyIssue,
  type ExecFn,
  type VerifyCheck,
} from '@/core/verification'
import {
  defaultConfig,
  makeIssue,
  makeProvider,
} from '@tests/fixtures/provider'

/** Returns an ExecFn that always exits with status 0. */
function okExec(): ExecFn {
  return () => Promise.resolve({ stdout: '', stderr: '', status: 0 })
}

/** Returns an ExecFn that always exits with non-zero status. */
function failExec(stderr = 'error output'): ExecFn {
  return () => Promise.resolve({ stdout: '', stderr, status: 1 })
}

/** Returns an ExecFn that fails on named checks and passes on others. */
function selectiveExec(failNames: string[], checks: VerifyCheck[]): ExecFn {
  return (_file, args = []) => {
    // Match check by looking up which check's args match
    const check = checks.find((c) => c.args.join(' ') === args.join(' '))
    const shouldFail = check ? failNames.includes(check.name) : false
    return Promise.resolve({
      stdout: '',
      stderr: shouldFail ? `${check?.name} failed` : '',
      status: shouldFail ? 1 : 0,
    })
  }
}

const THREE_CHECKS: VerifyCheck[] = [
  { name: 'build', command: 'bun', args: ['run', 'build'] },
  { name: 'check', command: 'bun', args: ['run', 'check'] },
  { name: 'test', command: 'bun', args: ['test'] },
]

describe('runVerification', () => {
  it('returns passed:true when all checks succeed', async () => {
    const result = await runVerification(THREE_CHECKS, okExec())
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().passed).toBe(true)
  })

  it('returns passed:false when any check fails', async () => {
    const result = await runVerification(THREE_CHECKS, failExec('build failed'))
    expect(result.isOk()).toBe(true)
    const outcome = result._unsafeUnwrap()
    expect(outcome.passed).toBe(false)
    if (!outcome.passed) {
      expect(outcome.failures.length).toBeGreaterThan(0)
    }
  })

  it('collects all failures, not just the first', async () => {
    // All checks fail
    const result = await runVerification(THREE_CHECKS, failExec())
    const outcome = result._unsafeUnwrap()
    expect(outcome.passed).toBe(false)
    if (!outcome.passed) {
      expect(outcome.failures.length).toBe(THREE_CHECKS.length)
    }
  })

  it('records failure exit code and output', async () => {
    const result = await runVerification(THREE_CHECKS, failExec('bad output'))
    const outcome = result._unsafeUnwrap()
    expect(outcome.passed).toBe(false)
    if (!outcome.passed) {
      expect(outcome.failures[0].exitCode).toBe(1)
      expect(outcome.failures[0].stderr).toBe('bad output')
    }
  })

  it('includes check name in failure', async () => {
    const result = await runVerification(
      THREE_CHECKS,
      selectiveExec(['build'], THREE_CHECKS),
    )
    const outcome = result._unsafeUnwrap()
    expect(outcome.passed).toBe(false)
    if (!outcome.passed) {
      expect(outcome.failures[0].check).toBe('build')
      expect(outcome.failures.some((f) => f.check === 'check')).toBe(false)
    }
  })

  it('returns ok(never) — never rejects', async () => {
    // Even with empty checks, resolves cleanly
    const result = await runVerification([], okExec())
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().passed).toBe(true)
  })
})

describe('verifyIssue', () => {
  it('skips issue with is_verify_fix=true', async () => {
    const issue = makeIssue({
      id: '001',
      state: 'COMPLETED',
      is_verify_fix: true,
    })
    let transitionCalled = false
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      transition: () => {
        transitionCalled = true
        return okAsync(issue)
      },
    })

    const result = await verifyIssue('001', defaultConfig(), provider, {
      execFn: okExec(),
    })
    expect(result.isOk()).toBe(true)
    expect(transitionCalled).toBe(false)
  })

  it('transitions to VERIFIED when all checks pass', async () => {
    const issue = makeIssue({ id: '001', state: 'COMPLETED', verify_count: 0 })
    let transitionTarget = ''
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      transition: (_id, to) => {
        transitionTarget = to
        return okAsync(makeIssue({ state: to }))
      },
    })

    const result = await verifyIssue('001', defaultConfig(), provider, {
      execFn: okExec(),
    })
    expect(result.isOk()).toBe(true)
    expect(transitionTarget).toBe('VERIFIED')
  })

  it('creates fix sub-issue and increments verify_count on failure', async () => {
    const issue = makeIssue({ id: '001', state: 'COMPLETED', verify_count: 0 })
    let createdIssueTitle = ''
    let wroteOnParent: Partial<typeof issue> | null = null
    let wroteOnChild: Partial<typeof issue> | null = null
    const fixIssue = makeIssue({ id: '999', state: 'NEW' })

    const provider = makeProvider({
      fetchIssue: (id) => {
        if (id === '001') return okAsync(issue)
        return okAsync(fixIssue)
      },
      createIssue: (input) => {
        createdIssueTitle = input.title ?? ''
        return okAsync(fixIssue)
      },
      writeIssue: (id, fields) => {
        if (id === '999') {
          wroteOnChild = fields
          return okAsync({ ...fixIssue, ...fields })
        }
        wroteOnParent = fields
        return okAsync({ ...issue, ...fields })
      },
    })

    const result = await verifyIssue('001', defaultConfig(), provider, {
      execFn: failExec(),
    })
    expect(result.isOk()).toBe(true)
    expect(createdIssueTitle).toContain('001')
    expect(wroteOnChild).toMatchObject({ is_verify_fix: true })
    expect(wroteOnParent).toMatchObject({ verify_count: 1 })
  })

  it('includes parent issueId in fix sub-issue', async () => {
    const issue = makeIssue({ id: '001', state: 'COMPLETED', verify_count: 0 })
    let createInput: { title?: string; body?: string; parent?: string } = {}
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      createIssue: (input) => {
        createInput = input
        return okAsync(makeIssue({ id: '999', state: 'NEW' }))
      },
      writeIssue: () => okAsync(issue),
    })

    await verifyIssue('001', defaultConfig(), provider, { execFn: failExec() })
    expect(createInput.parent).toBe('001')
    expect(createInput.body).toContain('001')
  })

  it('sets verify_exhausted and skips sub-issue when retries exhausted', async () => {
    const config = { ...defaultConfig(), maxVerifyRetries: 3 }
    const issue = makeIssue({ id: '001', state: 'COMPLETED', verify_count: 3 })
    let createdIssue = false
    let wroteFields: Partial<typeof issue> | null = null
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      createIssue: () => {
        createdIssue = true
        return okAsync(makeIssue({ id: '999', state: 'NEW' }))
      },
      writeIssue: (_id, fields) => {
        wroteFields = fields
        return okAsync({ ...issue, ...fields })
      },
    })

    const result = await verifyIssue('001', config, provider, {
      execFn: failExec(),
    })
    expect(result.isOk()).toBe(true)
    expect(createdIssue).toBe(false)
    expect(wroteFields).toMatchObject({ verify_exhausted: true })
  })

  it('returns err when fetchIssue fails', async () => {
    const provider = makeProvider({
      fetchIssue: () => errAsync(new Error('disk read error')),
    })

    const result = await verifyIssue('001', defaultConfig(), provider, {
      execFn: okExec(),
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('disk read error')
  })

  it('returns err when transition fails', async () => {
    const issue = makeIssue({ id: '001', state: 'COMPLETED', verify_count: 0 })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      transition: () => errAsync(new Error('transition blocked')),
    })

    const result = await verifyIssue('001', defaultConfig(), provider, {
      execFn: okExec(),
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('transition blocked')
  })

  it('returns err when createIssue fails on verify failure', async () => {
    const issue = makeIssue({ id: '001', state: 'COMPLETED', verify_count: 0 })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      createIssue: () => errAsync(new Error('cannot create')),
    })

    const result = await verifyIssue('001', defaultConfig(), provider, {
      execFn: failExec(),
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('cannot create')
  })
})
