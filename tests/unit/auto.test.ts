import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { errAsync, okAsync } from 'neverthrow'
import { autoCommand } from '@/cli/commands/auto'
import type { IssueProvider } from '@/core/issue/base'
import type { Issue, Config } from '@/types'
import { ConfigSchema } from '@/types'

const defaultConfig = (): Config => ConfigSchema.parse({})

/** Minimal stub IssueProvider — only `listIssues` is exercised by autoCommand. */
function makeProvider(listIssues: IssueProvider['listIssues']): IssueProvider {
  return {
    listIssues,
    fetchIssue: () => errAsync(new Error('not implemented')),
    createIssue: () => errAsync(new Error('not implemented')),
    writeIssue: () => errAsync(new Error('not implemented')),
    deleteIssue: () => errAsync(new Error('not implemented')),
    lockIssue: () => errAsync(new Error('not implemented')),
    unlockIssue: () => errAsync(new Error('not implemented')),
    isLocked: () => errAsync(new Error('not implemented')),
    transition: () => errAsync(new Error('not implemented')),
    autoSelect: () => errAsync(new Error('not implemented')),
    checkAcceptanceCriteria: () => errAsync(new Error('not implemented'))
  } as unknown as IssueProvider
}

describe('autoCommand', () => {
  beforeEach(() => {
    // Bun: process.exitCode = undefined is sticky; reset to 0 between tests
    process.exitCode = 0
  })

  afterEach(() => {
    process.exitCode = 0
  })

  it('sets exitCode 1 when listIssues() returns err', async () => {
    const provider = makeProvider(() => errAsync(new Error('gh: not authenticated')))

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(process.exitCode).toBe(1)
  })

  it('does not set exitCode when list is empty', async () => {
    const provider = makeProvider(() => okAsync([]))

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(process.exitCode).toBe(0)
  })

  it('does not set exitCode when all issues are in non-actionable states', async () => {
    const completedIssue: Issue = {
      id: '001',
      title: 'Done',
      state: 'COMPLETED',
      body: '',
      parent: undefined,
      children: [],
      split_count: 0
    }
    const provider = makeProvider(() => okAsync([completedIssue]))

    await autoCommand(provider, { batch: 1, max: 0 }, defaultConfig())

    expect(process.exitCode).toBe(0)
  })
})
