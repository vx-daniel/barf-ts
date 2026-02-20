import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { errAsync, okAsync } from 'neverthrow'
import { auditCommand } from '@/cli/commands/audit'
import { defaultConfig, makeIssue, makeProvider } from '@tests/fixtures/provider'

describe('auditCommand', () => {
  beforeEach(() => {
    process.exitCode = 0
  })

  afterEach(() => {
    process.exitCode = 0
  })

  it('sets exitCode 1 when listIssues returns err (--all mode)', async () => {
    const provider = makeProvider({
      listIssues: () => errAsync(new Error('provider error'))
    })

    await auditCommand(provider, { all: true }, defaultConfig())

    expect(process.exitCode).toBe(1)
  })

  it('does nothing when no COMPLETED issues exist', async () => {
    const provider = makeProvider({
      listIssues: () => okAsync([])
    })

    await auditCommand(provider, { all: true }, defaultConfig())

    expect(process.exitCode).toBe(0)
  })

  it('sets exitCode 1 when fetchIssue fails for --issue mode', async () => {
    const provider = makeProvider({
      fetchIssue: () => errAsync(new Error('not found'))
    })

    await auditCommand(provider, { issue: '001', all: false }, defaultConfig())

    expect(process.exitCode).toBe(1)
  })

  it('skips non-COMPLETED issues when --issue targets wrong state', async () => {
    const issue = makeIssue({ state: 'IN_PROGRESS' })
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue)
    })

    await auditCommand(provider, { issue: issue.id, all: false }, defaultConfig())

    // Not COMPLETED — should warn but not set exitCode=1
    expect(process.exitCode).toBe(0)
  })

  it('iterates over all COMPLETED issues in --all mode', async () => {
    const issues = [makeIssue({ id: '001' }), makeIssue({ id: '002' })]
    let fetchCount = 0
    const provider = makeProvider({
      listIssues: () => okAsync(issues),
      // Return IN_PROGRESS so auditIssue skips (avoids spawning Claude)
      fetchIssue: () => {
        fetchCount++
        return okAsync(makeIssue({ state: 'IN_PROGRESS' }))
      }
    })

    await auditCommand(provider, { all: true }, defaultConfig())

    // Both issues should have been fetched for auditing
    expect(fetchCount).toBe(2)
  })

  it('routes --issue to single-issue audit', async () => {
    let fetchedId = ''
    const provider = makeProvider({
      // Return IN_PROGRESS so auditIssue skips (avoids spawning Claude)
      fetchIssue: (id) => {
        fetchedId = id
        return okAsync(makeIssue({ id, state: 'IN_PROGRESS' }))
      }
    })

    await auditCommand(provider, { issue: '005', all: false }, defaultConfig())

    expect(fetchedId).toBe('005')
  })
})

describe('VALID_TRANSITIONS includes INTERVIEWING', () => {
  it('INTERVIEWING state is in IssueStateSchema', () => {
    const { IssueStateSchema } = require('@/types')
    expect(IssueStateSchema.options).toContain('INTERVIEWING')
  })

  it('VALID_TRANSITIONS maps NEW to INTERVIEWING only', () => {
    const { VALID_TRANSITIONS } = require('@/core/issue')
    expect(VALID_TRANSITIONS['NEW']).toEqual(['INTERVIEWING'])
    expect(VALID_TRANSITIONS['INTERVIEWING']).toEqual(['PLANNED'])
  })
})
