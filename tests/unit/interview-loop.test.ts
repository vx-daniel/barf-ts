import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { ResultAsync } from 'neverthrow'
import { okAsync, errAsync } from 'neverthrow'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Controllable mock for runClaudeIteration
let mockOutcome: { outcome: string; tokens: number; rateLimitResetsAt?: number } = {
  outcome: 'success',
  tokens: 100
}
let mockClaudeErr: Error | null = null
let mockClaudeSideEffect: (() => void) | null = null
let mockReadlineAnswers: string[] = []

// Mock readline so askQuestion/readLine don't block on stdin
mock.module('readline', () => ({
  createInterface: () => ({
    question: (_prompt: string, cb: (answer: string) => void) => {
      cb(mockReadlineAnswers.shift() ?? 'default')
    },
    close: () => {}
  })
}))

mock.module('@/core/claude', () => ({
  runClaudeIteration: () => {
    if (mockClaudeSideEffect) {
      mockClaudeSideEffect()
    }
    if (mockClaudeErr) {
      return ResultAsync.fromPromise(Promise.reject(mockClaudeErr), e => e as Error)
    }
    return ResultAsync.fromSafePromise(Promise.resolve(mockOutcome))
  },
  getThreshold: () => 150_000
}))

import { interviewLoop, runInterview } from '@/core/interview'
import type { Config } from '@/types'
import { ConfigSchema } from '@/types'
import { defaultConfig, makeIssue, makeProvider } from '@tests/fixtures/provider'

function makeTmpConfig(): Config {
  const root = mkdtempSync(join(tmpdir(), 'barf-interview-'))
  const issuesDir = join(root, 'issues')
  const barfDir = join(root, '.barf')
  const planDir = join(root, 'plans')
  mkdirSync(issuesDir, { recursive: true })
  mkdirSync(barfDir, { recursive: true })
  mkdirSync(planDir, { recursive: true })
  return { ...defaultConfig(), issuesDir, barfDir, planDir }
}

describe('interviewLoop', () => {
  beforeEach(() => {
    mockOutcome = { outcome: 'success', tokens: 100 }
    mockClaudeErr = null
    mockClaudeSideEffect = null
    mockReadlineAnswers = []
  })

  it('completes when no questions file is written', async () => {
    const config = makeTmpConfig()
    const issue = makeIssue({ id: '001', state: 'INTERVIEWING' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue)
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
  })

  it('returns err when runClaudeIteration fails', async () => {
    mockClaudeErr = new Error('spawn failed')
    const config = makeTmpConfig()
    const provider = makeProvider({
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('spawn failed')
  })

  it('stops on error outcome from Claude', async () => {
    mockOutcome = { outcome: 'error', tokens: 50 }
    const config = makeTmpConfig()
    const provider = makeProvider({
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
  })

  it('throws on rate_limited outcome', async () => {
    mockOutcome = { outcome: 'rate_limited', tokens: 50, rateLimitResetsAt: 1700000000 }
    const config = makeTmpConfig()
    const provider = makeProvider({
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('Rate limited')
  })

  it('handles rate_limited without resetsAt', async () => {
    mockOutcome = { outcome: 'rate_limited', tokens: 50 }
    const config = makeTmpConfig()
    const provider = makeProvider({
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('Rate limited')
  })

  it('stops when questions file has complete:true signal', async () => {
    const config = makeTmpConfig()
    const questionsFile = join(config.barfDir, '001-interview.json')

    mockClaudeSideEffect = () => {
      writeFileSync(questionsFile, JSON.stringify({ complete: true }))
    }

    const provider = makeProvider({
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
  })

  it('stops when questions file has invalid shape', async () => {
    const config = makeTmpConfig()
    const questionsFile = join(config.barfDir, '001-interview.json')

    mockClaudeSideEffect = () => {
      writeFileSync(questionsFile, JSON.stringify({ bad: 'shape' }))
    }

    const provider = makeProvider({
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
  })

  it('stops when questions file is not valid JSON', async () => {
    const config = makeTmpConfig()
    const questionsFile = join(config.barfDir, '001-interview.json')

    mockClaudeSideEffect = () => {
      writeFileSync(questionsFile, 'not json{{{')
    }

    const provider = makeProvider({
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
  })

  it('cleans up leftover questions file before each turn', async () => {
    const config = makeTmpConfig()
    const questionsFile = join(config.barfDir, '001-interview.json')
    // Create a leftover questions file
    writeFileSync(questionsFile, 'leftover')

    const provider = makeProvider({
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
    // Leftover should be cleaned up; no questions file after completion
    expect(existsSync(questionsFile)).toBe(false)
  })

  it('collects Q&A with option selection and appends to issue body', async () => {
    const config = makeTmpConfig()
    const questionsFile = join(config.barfDir, '001-interview.json')
    let turnCount = 0

    mockClaudeSideEffect = () => {
      turnCount++
      if (turnCount === 1) {
        writeFileSync(
          questionsFile,
          JSON.stringify({
            questions: [{ question: 'What color?', options: ['Red', 'Blue'] }]
          })
        )
      }
      // Turn 2: no questions file → loop ends
    }

    // Answer "1" to select first option ("Red")
    mockReadlineAnswers = ['1']

    let writtenBody = ''
    const issue = makeIssue({ id: '001', state: 'INTERVIEWING', body: 'Original body' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: (_id, updates) => {
        writtenBody = updates.body ?? ''
        return okAsync(issue)
      }
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
    expect(writtenBody).toContain('## Interview Q&A')
    expect(writtenBody).toContain('What color?')
    expect(writtenBody).toContain('Red')
  })

  it('collects Q&A with free-text answer (no options)', async () => {
    const config = makeTmpConfig()
    const questionsFile = join(config.barfDir, '001-interview.json')
    let turnCount = 0

    mockClaudeSideEffect = () => {
      turnCount++
      if (turnCount === 1) {
        writeFileSync(
          questionsFile,
          JSON.stringify({
            questions: [{ question: 'Describe the bug' }]
          })
        )
      }
    }

    mockReadlineAnswers = ['It crashes on startup']

    let writtenBody = ''
    const issue = makeIssue({ id: '001', state: 'INTERVIEWING', body: 'Bug report' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: (_id, updates) => {
        writtenBody = updates.body ?? ''
        return okAsync(issue)
      }
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
    expect(writtenBody).toContain('Describe the bug')
    expect(writtenBody).toContain('It crashes on startup')
  })

  it('handles Other option selection in askQuestion', async () => {
    const config = makeTmpConfig()
    const questionsFile = join(config.barfDir, '001-interview.json')
    let turnCount = 0

    mockClaudeSideEffect = () => {
      turnCount++
      if (turnCount === 1) {
        writeFileSync(
          questionsFile,
          JSON.stringify({
            questions: [{ question: 'Priority?', options: ['High', 'Low'] }]
          })
        )
      }
    }

    // "3" is out of range for 2 options → triggers "Other" → next answer is free-text
    mockReadlineAnswers = ['3', 'Medium priority']

    let writtenBody = ''
    const issue = makeIssue({ id: '001', state: 'INTERVIEWING', body: 'Body' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: (_id, updates) => {
        writtenBody = updates.body ?? ''
        return okAsync(issue)
      }
    })

    const result = await interviewLoop('001', config, provider)
    expect(result.isOk()).toBe(true)
    expect(writtenBody).toContain('Medium priority')
  })

  it('warns but succeeds when writeIssue fails during Q&A append', async () => {
    const config = makeTmpConfig()
    const questionsFile = join(config.barfDir, '001-interview.json')
    let turnCount = 0

    mockClaudeSideEffect = () => {
      turnCount++
      if (turnCount === 1) {
        writeFileSync(
          questionsFile,
          JSON.stringify({
            questions: [{ question: 'What color?', options: ['Red'] }]
          })
        )
      }
    }

    mockReadlineAnswers = ['1']

    const issue = makeIssue({ id: '001', state: 'INTERVIEWING', body: 'Body' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      writeIssue: () => errAsync(new Error('write failed'))
    })

    const result = await interviewLoop('001', config, provider)
    // Should still succeed — writeIssue failure is just a warning
    expect(result.isOk()).toBe(true)
  })
})

describe('runInterview', () => {
  beforeEach(() => {
    mockOutcome = { outcome: 'success', tokens: 100 }
    mockClaudeErr = null
    mockClaudeSideEffect = null
    mockReadlineAnswers = []
  })

  it('transitions INTERVIEWING → runs loop → transitions PLANNED', async () => {
    const config = makeTmpConfig()
    let transitions: string[] = []
    const provider = makeProvider({
      transition: (_id, to) => {
        transitions.push(to)
        return okAsync(makeIssue({ state: to }))
      },
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
      writeIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await runInterview('001', config, provider)
    expect(result.isOk()).toBe(true)
    expect(transitions).toEqual(['INTERVIEWING', 'PLANNED'])
  })

  it('returns err when first transition fails', async () => {
    const config = makeTmpConfig()
    const provider = makeProvider({
      transition: () => errAsync(new Error('transition failed'))
    })

    const result = await runInterview('001', config, provider)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('transition failed')
  })

  it('returns err when interview loop fails', async () => {
    mockClaudeErr = new Error('claude died')
    const config = makeTmpConfig()
    const provider = makeProvider({
      transition: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await runInterview('001', config, provider)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('claude died')
  })

  it('returns err when final transition fails', async () => {
    const config = makeTmpConfig()
    let callCount = 0
    const provider = makeProvider({
      transition: () => {
        callCount++
        if (callCount === 1) {
          return okAsync(makeIssue({ state: 'INTERVIEWING' }))
        }
        return errAsync(new Error('PLANNED transition failed'))
      },
      fetchIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' })),
      writeIssue: () => okAsync(makeIssue({ state: 'INTERVIEWING' }))
    })

    const result = await runInterview('001', config, provider)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('PLANNED transition failed')
  })
})
