import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { errAsync, okAsync } from 'neverthrow'
import type { SdkTurnResult } from '@/core/claude-sdk'
import { interviewCommand } from '@/cli/commands/interview'
import { interviewLoop } from '@/core/interview'
import type { IssueProvider } from '@/core/issue/base'
import type { Issue, Config } from '@/types'
import { ConfigSchema } from '@/types'

// ---------------------------------------------------------------------------
// Module mock: intercept runSdkTurn before any test runs.
// Bun v1.0.18+ replaces live module bindings retroactively.
// ---------------------------------------------------------------------------

const mockResponses: Array<{ value?: SdkTurnResult; error?: Error }> = []
let callIndex = 0

mock.module('@/core/claude-sdk', () => ({
  runSdkTurn: () => {
    const resp = mockResponses[callIndex++]
    if (!resp) return errAsync(new Error('unexpected runSdkTurn call'))
    return resp.error ? errAsync(resp.error) : okAsync(resp.value!)
  },
}))

function mockTurns(...results: Array<SdkTurnResult | Error>): void {
  mockResponses.length = 0
  callIndex = 0
  for (const r of results) {
    if (r instanceof Error) {
      mockResponses.push({ error: r })
    } else {
      mockResponses.push({ value: r })
    }
  }
}

function sdkResult(structuredOutput: unknown, tokens = 10): SdkTurnResult {
  return { sessionId: 'session-test', structuredOutput, tokens }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const defaultConfig = (): Config => ConfigSchema.parse({})

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: '001',
    title: 'Test issue',
    state: 'NEW',
    parent: '',
    children: [],
    split_count: 0,
    body: '## Description\nBuild a widget.',
    ...overrides,
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
    ...overrides,
  } as unknown as IssueProvider
}

// ---------------------------------------------------------------------------
// interviewCommand tests
// ---------------------------------------------------------------------------

describe('interviewCommand', () => {
  beforeEach(() => {
    process.exitCode = 0
  })

  it('sets exitCode 1 when autoSelect returns err', async () => {
    const provider = makeProvider({
      autoSelect: () => errAsync(new Error('provider error')),
    })

    await interviewCommand(provider, {}, defaultConfig())

    expect(process.exitCode).toBe(1)
  })

  it('does nothing when autoSelect returns null (no NEW issues)', async () => {
    const provider = makeProvider({
      autoSelect: () => okAsync(null),
    })

    await interviewCommand(provider, {}, defaultConfig())

    expect(process.exitCode).toBe(0)
  })

  it('sets exitCode 1 when transition NEW → INTERVIEWING fails', async () => {
    const issue = makeIssue()
    const provider = makeProvider({
      transition: () => errAsync(new Error('transition failed')),
    })

    await interviewCommand(provider, { issue: issue.id }, defaultConfig())

    expect(process.exitCode).toBe(1)
  })

  it('uses provided issue id instead of auto-selecting', async () => {
    const issue = makeIssue({ state: 'NEW' })
    let autoSelectCalled = false
    let transitionCalled = false

    // Return complete:true so the interview loop terminates immediately
    mockTurns(sdkResult({ complete: true }))

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
        return okAsync(makeIssue({ state: 'PLANNED' }))
      },
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
      writeIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
    })

    await interviewCommand(provider, { issue: issue.id }, defaultConfig())

    expect(autoSelectCalled).toBe(false)
    expect(transitionCalled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// interviewLoop tests
// ---------------------------------------------------------------------------

describe('interviewLoop', () => {
  beforeEach(() => {
    mockTurns()
  })

  it('returns ok when Claude signals complete:true immediately', async () => {
    mockTurns(sdkResult({ complete: true }))

    const provider = makeProvider()
    const result = await interviewLoop('001', defaultConfig(), provider)

    expect(result.isOk()).toBe(true)
  })

  it('returns err when runSdkTurn returns an SDK error', async () => {
    mockTurns(new Error('SDK error: error_during_execution: auth failed'))

    const provider = makeProvider()
    const result = await interviewLoop('001', defaultConfig(), provider)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('auth failed')
  })

  it('returns err when runSdkTurn returns error_max_turns', async () => {
    mockTurns(new Error('SDK error: error_max_turns'))

    const provider = makeProvider()
    const result = await interviewLoop('001', defaultConfig(), provider)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('error_max_turns')
  })

  it('calls promptUser and writes Q&A to issue when questions are returned', async () => {
    mockTurns(
      sdkResult({ questions: [{ question: 'What language?' }, { question: 'What framework?' }] }),
      sdkResult({ complete: true })
    )

    const issue = makeIssue()
    let writtenBody: string | undefined

    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: (_id, update) => {
        writtenBody = update.body
        return okAsync(makeIssue({ body: update.body }))
      },
    })

    const answers = ['TypeScript', 'Bun']
    let answerIndex = 0
    const promptUser = async () => answers[answerIndex++]!

    const result = await interviewLoop('001', defaultConfig(), provider, undefined, undefined, promptUser)

    expect(result.isOk()).toBe(true)
    expect(writtenBody).toContain('## Interview Q&A')
    expect(writtenBody).toContain('What language?')
    expect(writtenBody).toContain('TypeScript')
    expect(writtenBody).toContain('What framework?')
    expect(writtenBody).toContain('Bun')
  })

  it('returns ok and stops when structured output has unexpected shape', async () => {
    mockTurns(sdkResult({ unexpected_field: true }))

    const provider = makeProvider()
    const result = await interviewLoop('001', defaultConfig(), provider)

    // Unexpected shape triggers warn + break → ok(void)
    expect(result.isOk()).toBe(true)
  })

  it('returns ok and stops when structuredOutput is undefined', async () => {
    mockTurns(sdkResult(undefined))

    const provider = makeProvider()
    const result = await interviewLoop('001', defaultConfig(), provider)

    expect(result.isOk()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// ConfigSchema defaults
// ---------------------------------------------------------------------------

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
