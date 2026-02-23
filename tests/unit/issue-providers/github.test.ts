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

const GH_ISSUE_PLANNED = {
  number: 2,
  title: 'Planned Issue',
  body: 'planned body',
  state: 'open',
  labels: [{ name: 'barf:planned' }],
  milestone: null
}

/** Helper: mock auth + one API call */
function authThen(response: object) {
  mockSpawn
    .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
    .mockResolvedValueOnce({ stdout: JSON.stringify(response), stderr: '', status: 0 })
}

describe('GitHubIssueProvider', () => {
  let provider: GitHubIssueProvider

  beforeEach(() => {
    mockSpawn.mockClear()
    provider = new GitHubIssueProvider('owner/repo', mockSpawn)
  })

  // ── fetchIssue ────────────────────────────────────────────────────────────

  it('maps barf:new label to NEW state', async () => {
    authThen(GH_ISSUE_NEW)
    const result = await provider.fetchIssue('1')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().state).toBe('NEW')
  })

  it('maps closed issue to COMPLETED', async () => {
    const closed = { ...GH_ISSUE_NEW, state: 'closed', labels: [{ name: 'barf:completed' }] }
    authThen(closed)
    const result = await provider.fetchIssue('1')
    expect(result._unsafeUnwrap().state).toBe('COMPLETED')
  })

  it('defaults open issue with no barf label to NEW', async () => {
    authThen({ ...GH_ISSUE_NEW, labels: [] })
    const result = await provider.fetchIssue('1')
    expect(result._unsafeUnwrap().state).toBe('NEW')
  })

  it('maps null body to empty string', async () => {
    authThen({ ...GH_ISSUE_NEW, body: null })
    const result = await provider.fetchIssue('1')
    expect(result._unsafeUnwrap().body).toBe('')
  })

  it('sets force_split=false on fetched issues', async () => {
    authThen(GH_ISSUE_NEW)
    const result = await provider.fetchIssue('1')
    expect(result._unsafeUnwrap().force_split).toBe(false)
  })

  it('returns Err when gh auth fails', async () => {
    mockSpawn.mockResolvedValueOnce({ stdout: '', stderr: 'not logged in', status: 1 })
    const result = await provider.fetchIssue('1')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('gh auth')
  })

  it('returns Err when API call fails', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'not found', status: 1 })
    const result = await provider.fetchIssue('999')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('gh api error')
  })

  it('caches auth token after first call', async () => {
    authThen(GH_ISSUE_NEW)
    await provider.fetchIssue('1')

    // Second call should not call auth again
    mockSpawn.mockResolvedValueOnce({
      stdout: JSON.stringify(GH_ISSUE_NEW),
      stderr: '',
      status: 0
    })
    await provider.fetchIssue('1')

    // Total calls: auth(1) + api(1) + api(1) = 3 (no second auth)
    expect(mockSpawn).toHaveBeenCalledTimes(3)
  })

  // ── listIssues ────────────────────────────────────────────────────────────

  it('lists open issues', async () => {
    authThen([GH_ISSUE_NEW, GH_ISSUE_PLANNED])
    const result = await provider.listIssues()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(2)
  })

  it('filters by state when filter provided', async () => {
    authThen([GH_ISSUE_PLANNED])
    const result = await provider.listIssues({ state: 'PLANNED' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(1)
    expect(result._unsafeUnwrap()[0].state).toBe('PLANNED')
  })

  it('returns Err when listIssues API fails', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'server error', status: 1 })
    const result = await provider.listIssues()
    expect(result.isErr()).toBe(true)
  })

  // ── createIssue ───────────────────────────────────────────────────────────

  it('creates a new issue via API', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify(GH_ISSUE_NEW),
        stderr: '',
        status: 0
      })
    const result = await provider.createIssue({ title: 'New', body: 'body text' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().title).toBe('First Issue')
  })

  it('creates issue with empty body when not provided', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify(GH_ISSUE_NEW),
        stderr: '',
        status: 0
      })
    const result = await provider.createIssue({ title: 'Minimal' })
    expect(result.isOk()).toBe(true)
  })

  it('returns Err when createIssue API fails', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'rate limit', status: 1 })
    const result = await provider.createIssue({ title: 'Fail' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('Failed to create issue')
  })

  // ── writeIssue ────────────────────────────────────────────────────────────

  it('patches title via API', async () => {
    // auth + fetchIssue + patch
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_NEW), stderr: '', status: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ ...GH_ISSUE_NEW, title: 'Updated' }),
        stderr: '',
        status: 0
      })
    const result = await provider.writeIssue('1', { title: 'Updated' })
    expect(result.isOk()).toBe(true)
  })

  it('patches body via API', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_NEW), stderr: '', status: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ ...GH_ISSUE_NEW, body: 'new body' }),
        stderr: '',
        status: 0
      })
    const result = await provider.writeIssue('1', { body: 'new body' })
    expect(result.isOk()).toBe(true)
  })

  it('changes state labels when state changes', async () => {
    // auth + fetchIssue + DELETE label + POST label + PATCH
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_NEW), stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', status: 0 }) // DELETE old label
      .mockResolvedValueOnce({ stdout: '', stderr: '', status: 0 }) // POST new label
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ ...GH_ISSUE_NEW, labels: [{ name: 'barf:planned' }] }),
        stderr: '',
        status: 0
      })
    const result = await provider.writeIssue('1', { state: 'PLANNED' })
    expect(result.isOk()).toBe(true)
  })

  it('closes issue when state set to COMPLETED', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_NEW), stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', status: 0 }) // DELETE old label
      .mockResolvedValueOnce({ stdout: '', stderr: '', status: 0 }) // POST new label
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ ...GH_ISSUE_NEW, state: 'closed' }),
        stderr: '',
        status: 0
      })
    const result = await provider.writeIssue('1', { state: 'COMPLETED' })
    expect(result.isOk()).toBe(true)
  })

  // ── lockIssue / unlockIssue ───────────────────────────────────────────────

  it('locks issue by adding barf:locked label', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', status: 0 })
    const result = await provider.lockIssue('1')
    expect(result.isOk()).toBe(true)
  })

  it('unlocks issue by removing barf:locked label', async () => {
    mockSpawn
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', status: 0 })
    const result = await provider.unlockIssue('1')
    expect(result.isOk()).toBe(true)
  })

  // ── isLocked ──────────────────────────────────────────────────────────────

  it('isLocked detects barf:locked label', async () => {
    const locked = { ...GH_ISSUE_NEW, labels: [{ name: 'barf:locked' }] }
    authThen(locked)
    expect((await provider.isLocked('1'))._unsafeUnwrap()).toBe(true)
  })

  it('isLocked returns false when no locked label', async () => {
    authThen(GH_ISSUE_NEW)
    expect((await provider.isLocked('1'))._unsafeUnwrap()).toBe(false)
  })

  // ── deleteIssue ───────────────────────────────────────────────────────────

  it('deleteIssue returns Err — GitHub does not support deletion', async () => {
    const result = await provider.deleteIssue('1')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('cannot be deleted')
  })

  // ── state label mapping ───────────────────────────────────────────────────

  it('maps unknown label to NEW state (barf:interviewing no longer exists)', async () => {
    authThen({ ...GH_ISSUE_NEW, labels: [{ name: 'barf:interviewing' }] })
    const result = await provider.fetchIssue('1')
    // barf:interviewing is no longer a recognized label — falls back to NEW
    expect(result._unsafeUnwrap().state).toBe('NEW')
  })

  it('maps barf:in-progress label to IN_PROGRESS state', async () => {
    authThen({ ...GH_ISSUE_NEW, labels: [{ name: 'barf:in-progress' }] })
    const result = await provider.fetchIssue('1')
    expect(result._unsafeUnwrap().state).toBe('IN_PROGRESS')
  })

  it('maps barf:stuck label to STUCK state', async () => {
    authThen({ ...GH_ISSUE_NEW, labels: [{ name: 'barf:stuck' }] })
    const result = await provider.fetchIssue('1')
    expect(result._unsafeUnwrap().state).toBe('STUCK')
  })

  it('maps barf:split label to SPLIT state', async () => {
    authThen({ ...GH_ISSUE_NEW, labels: [{ name: 'barf:split' }] })
    const result = await provider.fetchIssue('1')
    expect(result._unsafeUnwrap().state).toBe('SPLIT')
  })
})
