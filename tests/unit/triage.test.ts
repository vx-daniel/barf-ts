import { describe, it, expect, beforeEach } from 'bun:test'
import { okAsync, errAsync } from 'neverthrow'
import type { ExecFn } from '@/core/triage'
import { triageIssue } from '@/core/triage'
import { parseTriageResponse } from '@/core/triage/parse'
import {
  defaultConfig,
  makeIssue,
  makeProvider,
} from '@tests/fixtures/provider'

describe('parseTriageResponse', () => {
  it('parses clean JSON with needs_interview=false', () => {
    const result = parseTriageResponse(JSON.stringify({ needs_interview: false }))
    expect(result).toEqual({ needs_interview: false })
  })

  it('parses clean JSON with needs_interview=true and questions', () => {
    const input = JSON.stringify({
      needs_interview: true,
      questions: [{ question: 'What is the scope?' }],
    })
    const result = parseTriageResponse(input)
    expect(result).toMatchObject({ needs_interview: true })
  })

  it('strips backtick code fences', () => {
    const input = '```json\n{"needs_interview": false}\n```'
    const result = parseTriageResponse(input)
    expect(result).toEqual({ needs_interview: false })
  })

  it('extracts JSON from surrounding prose', () => {
    const input = 'Here is my evaluation: {"needs_interview": false} Hope that helps!'
    const result = parseTriageResponse(input)
    expect(result).toEqual({ needs_interview: false })
  })

  it('extracts JSON from asterisk markdown surrounding (the actual bug)', () => {
    const input =
      '**Analysis:** After reviewing the issue, here is my result:\n\n{"needs_interview": false}\n\n*Let me know if you need anything else.*'
    const result = parseTriageResponse(input)
    expect(result).toEqual({ needs_interview: false })
  })

  it('handles code fence with surrounding prose (fence stripped first, then prose extracted)', () => {
    const input =
      'Sure! Here you go:\n```json\n{"needs_interview": false}\n```\nHope that is helpful.'
    const result = parseTriageResponse(input)
    expect(result).toEqual({ needs_interview: false })
  })

  it('throws on completely unparseable input', () => {
    expect(() => parseTriageResponse('not json at all')).toThrow('Failed to parse triage response')
  })

  it('throws on unexpected JSON shape', () => {
    expect(() => parseTriageResponse('{"unexpected": "shape"}')).toThrow(
      'Failed to parse triage response',
    )
  })
})

/** Creates an ExecFn that returns the given result synchronously. */
function mockExec(result: {
  stdout: string
  stderr: string
  status: number
}): ExecFn {
  return () => Promise.resolve(result)
}

/** Wraps a triage result in the Claude CLI JSON envelope (`--output-format json`). */
function envelope(triageResult: unknown): string {
  return JSON.stringify({
    result: JSON.stringify(triageResult),
    usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  })
}

const okExec = mockExec({
  stdout: envelope({ needs_interview: false }),
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

  it('sets needs_interview=false and transitions to GROOMED for well-specified issue', async () => {
    const exec = mockExec({
      stdout: envelope({ needs_interview: false }),
      stderr: '',
      status: 0,
    })
    const issue = makeIssue({
      id: '001',
      state: 'NEW',
      body: 'Well-specified body',
    })
    const writes: Record<string, unknown>[] = []
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: (_id, fields) => {
        writes.push(fields)
        return okAsync({ ...issue, ...fields })
      },
    })

    const result = await triageIssue('001', defaultConfig(), provider, exec)

    expect(result.isOk()).toBe(true)
    expect(writes[0].needs_interview).toBe(false)
    expect(writes[0].state).toBe('GROOMED')
  })

  it('sets needs_interview=true and stays in NEW for underspecified issue', async () => {
    const exec = mockExec({
      stdout: envelope({
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
    const writes: Record<string, unknown>[] = []
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: (_id, fields) => {
        writes.push(fields)
        return okAsync({ ...issue, ...fields })
      },
    })

    const result = await triageIssue('002', defaultConfig(), provider, exec)

    expect(result.isOk()).toBe(true)
    expect(writes[0].needs_interview).toBe(true)
    // Should NOT transition to STUCK — stays in NEW
    expect(writes[0].state).toBeUndefined()
    expect(typeof writes[0].body).toBe('string')
    const body = writes[0].body as string
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
    // JSON.parse throws a SyntaxError on invalid input
    expect(result._unsafeUnwrapErr().message).toMatch(/JSON|parse|syntax/i)
  })

  it('returns err when claude outputs unexpected JSON envelope shape', async () => {
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
    expect(result._unsafeUnwrapErr().message).toContain('Unexpected Claude JSON envelope')
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
