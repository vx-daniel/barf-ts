import { describe, it, expect, beforeEach } from 'bun:test'
import { okAsync, errAsync } from 'neverthrow'
import type { ExecFn } from '@/core/triage'
import { triageIssue } from '@/core/triage'
import {
  defaultConfig,
  makeIssue,
  makeProvider,
} from '@tests/fixtures/provider'

/** Creates an ExecFn that returns the given result synchronously. */
function mockExec(result: {
  stdout: string
  stderr: string
  status: number
}): ExecFn {
  return () => Promise.resolve(result)
}

const okExec = mockExec({
  stdout: JSON.stringify({ needs_interview: false }),
  stderr: '',
  status: 0,
})

describe('triageIssue', () => {
  it('skips issue already triaged (needs_interview=false)', async () => {
    const issue = makeIssue({
      id: '001',
      state: 'NEW',
      needs_interview: false,
    })
    let writeIssueCallCount = 0
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: () => {
        writeIssueCallCount++
        return okAsync(issue)
      },
    })

    const result = await triageIssue('001', defaultConfig(), provider, okExec)

    expect(result.isOk()).toBe(true)
    expect(writeIssueCallCount).toBe(0)
  })

  it('skips issue already triaged (needs_interview=true)', async () => {
    const issue = makeIssue({ id: '001', state: 'NEW', needs_interview: true })
    let writeIssueCallCount = 0
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: () => {
        writeIssueCallCount++
        return okAsync(issue)
      },
    })

    const result = await triageIssue('001', defaultConfig(), provider, okExec)

    expect(result.isOk()).toBe(true)
    expect(writeIssueCallCount).toBe(0)
  })

  it('sets needs_interview=false for well-specified issue', async () => {
    const exec = mockExec({
      stdout: JSON.stringify({ needs_interview: false }),
      stderr: '',
      status: 0,
    })
    const issue = makeIssue({
      id: '001',
      state: 'NEW',
      body: 'Well-specified body',
    })
    let writtenFields: Record<string, unknown> = {}
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: (_id, fields) => {
        writtenFields = fields
        return okAsync({ ...issue, ...fields })
      },
    })

    const result = await triageIssue('001', defaultConfig(), provider, exec)

    expect(result.isOk()).toBe(true)
    expect(writtenFields.needs_interview).toBe(false)
  })

  it('sets needs_interview=true and appends questions for underspecified issue', async () => {
    const exec = mockExec({
      stdout: JSON.stringify({
        needs_interview: true,
        questions: [
          { question: 'What is the scope?', options: ['Small', 'Large'] },
          { question: 'Any deadlines?' },
        ],
      }),
      stderr: '',
      status: 0,
    })

    const issue = makeIssue({
      id: '002',
      state: 'NEW',
      body: 'Vague description',
    })
    let writtenFields: Record<string, unknown> = {}
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: (_id, fields) => {
        writtenFields = fields
        return okAsync({ ...issue, ...fields })
      },
    })

    const result = await triageIssue('002', defaultConfig(), provider, exec)

    expect(result.isOk()).toBe(true)
    expect(writtenFields.needs_interview).toBe(true)
    expect(typeof writtenFields.body).toBe('string')
    const body = writtenFields.body as string
    expect(body).toContain('## Interview Questions')
    expect(body).toContain('What is the scope?')
    expect(body).toContain('Any deadlines?')
    expect(body).toContain('Small')
    expect(body).toContain('Large')
  })

  it('returns err when fetchIssue fails', async () => {
    const provider = makeProvider({
      fetchIssue: () => errAsync(new Error('not found')),
    })

    const result = await triageIssue('999', defaultConfig(), provider, okExec)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('not found')
  })

  it('returns err when claude exits with non-zero status', async () => {
    const exec = mockExec({
      stdout: '',
      stderr: 'command not found',
      status: 127,
    })
    const issue = makeIssue({ id: '003', state: 'NEW' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
    })

    const result = await triageIssue('003', defaultConfig(), provider, exec)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('exit 127')
  })

  it('returns err when claude outputs invalid JSON', async () => {
    const exec = mockExec({ stdout: 'not json at all', stderr: '', status: 0 })
    const issue = makeIssue({ id: '004', state: 'NEW' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
    })

    const result = await triageIssue('004', defaultConfig(), provider, exec)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('Failed to parse')
  })

  it('returns err when claude outputs unexpected JSON shape', async () => {
    const exec = mockExec({
      stdout: JSON.stringify({ unexpected: 'shape' }),
      stderr: '',
      status: 0,
    })
    const issue = makeIssue({ id: '005', state: 'NEW' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
    })

    const result = await triageIssue('005', defaultConfig(), provider, exec)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('Failed to parse')
  })

  it('returns err when writeIssue fails', async () => {
    const issue = makeIssue({ id: '006', state: 'NEW' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: () => errAsync(new Error('disk full')),
    })

    const result = await triageIssue('006', defaultConfig(), provider, okExec)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('disk full')
  })
})
