import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { GitHubIssueProvider } from '@/core/issue/providers/github'

const mockSpawn = mock(() => Promise.resolve({ stdout: '', stderr: '', status: 0 }))

const GH_ISSUE_NEW = {
  number: 1,
  title: 'First Issue',
  body: '## Description\nTest issue',
  state: 'open',
  labels: [{ name: 'barf:new' }],
  milestone: null
}

describe('GitHubIssueProvider', () => {
  let provider: GitHubIssueProvider

  beforeEach(() => {
    mockSpawn.mockClear()
    provider = new GitHubIssueProvider('owner/repo', mockSpawn)
  })

  it('maps barf:new label to NEW state', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 }) // auth
      .mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_NEW), stderr: '', status: 0 })
    const result = await provider.fetchIssue('1')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().state).toBe('NEW')
  })

  it('maps closed issue to COMPLETED', async () => {
    const closed = { ...GH_ISSUE_NEW, state: 'closed', labels: [{ name: 'barf:completed' }] }
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: JSON.stringify(closed), stderr: '', status: 0 })
    const result = await provider.fetchIssue('1')
    expect(result._unsafeUnwrap().state).toBe('COMPLETED')
  })

  it('returns Err when gh auth fails', async () => {
    mockSpawn.mockResolvedValueOnce({ stdout: '', stderr: 'not logged in', status: 1 })
    const result = await provider.fetchIssue('1')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('gh auth')
  })

  it('isLocked detects barf:locked label', async () => {
    const locked = { ...GH_ISSUE_NEW, labels: [{ name: 'barf:locked' }] }
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: JSON.stringify(locked), stderr: '', status: 0 })
    expect((await provider.isLocked('1'))._unsafeUnwrap()).toBe(true)
  })

  it('deleteIssue returns Err — GitHub does not support deletion', async () => {
    const result = await provider.deleteIssue('1')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('cannot be deleted')
  })
})
