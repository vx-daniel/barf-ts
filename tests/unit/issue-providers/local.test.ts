import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { LocalIssueProvider } from '@/core/issue/providers/local'

const ISSUE_001 = `---
id=001
title=First Issue
state=NEW
parent=
children=
split_count=0
force_split=false
---

## Description
Test issue

## Acceptance Criteria
- [x] Done
`

let dir: string
let provider: LocalIssueProvider

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'barf-test-'))
  mkdirSync(join(dir, 'issues'), { recursive: true })
  writeFileSync(join(dir, 'issues', '001.md'), ISSUE_001)
  provider = new LocalIssueProvider(join(dir, 'issues'), join(dir, '.barf'))
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('LocalIssueProvider', () => {
  it('fetches an issue by id', async () => {
    const result = await provider.fetchIssue('001')
    expect(result.isOk()).toBe(true)
    const issue = result._unsafeUnwrap()
    expect(issue.id).toBe('001')
    expect(issue.state).toBe('NEW')
  })

  it('returns Err when issue file not found', async () => {
    const result = await provider.fetchIssue('999')
    expect(result.isErr()).toBe(true)
  })

  it('lists all issues', async () => {
    const result = await provider.listIssues()
    expect(result._unsafeUnwrap()).toHaveLength(1)
  })

  it('filters by state', async () => {
    const news = (await provider.listIssues({ state: 'NEW' }))._unsafeUnwrap()
    const planned = (await provider.listIssues({ state: 'PLANNED' }))._unsafeUnwrap()
    expect(news).toHaveLength(1)
    expect(planned).toHaveLength(0)
  })

  it('writes updated fields atomically', async () => {
    await provider.writeIssue('001', { state: 'PLANNED' })
    const issue = (await provider.fetchIssue('001'))._unsafeUnwrap()
    expect(issue.state).toBe('PLANNED')
  })

  it('creates a new issue with next sequential id', async () => {
    const result = await provider.createIssue({ title: 'New Issue' })
    const issue = result._unsafeUnwrap()
    expect(issue.id).toBe('002')
    expect(issue.state).toBe('NEW')
  })

  it('transition() validates and applies state change', async () => {
    const result = await provider.transition('001', 'PLANNED')
    expect(result._unsafeUnwrap().state).toBe('PLANNED')
  })

  it('transition() returns Err on invalid state change', async () => {
    const result = await provider.transition('001', 'COMPLETED')
    expect(result.isErr()).toBe(true)
  })

  it('locks and unlocks an issue', async () => {
    expect((await provider.isLocked('001'))._unsafeUnwrap()).toBe(false)
    await provider.lockIssue('001')
    expect((await provider.isLocked('001'))._unsafeUnwrap()).toBe(true)
    await provider.unlockIssue('001')
    expect((await provider.isLocked('001'))._unsafeUnwrap()).toBe(false)
  })

  it('autoSelect returns highest priority unlocked issue for plan mode', async () => {
    const result = await provider.autoSelect('plan')
    expect(result._unsafeUnwrap()?.id).toBe('001')
  })

  it('autoSelect returns null when all issues locked', async () => {
    await provider.lockIssue('001')
    const result = await provider.autoSelect('plan')
    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('lockIssue succeeds when a stale lock from a dead process exists', async () => {
    mkdirSync(join(dir, '.barf'), { recursive: true })
    writeFileSync(
      join(dir, '.barf', '001.lock'),
      JSON.stringify({
        pid: 999999999,
        acquiredAt: new Date().toISOString(),
        state: 'IN_PROGRESS',
        mode: 'build'
      })
    )
    const result = await provider.lockIssue('001', { mode: 'build' })
    expect(result.isOk()).toBe(true)
    expect(existsSync(join(dir, '.barf', '001.lock'))).toBe(true) // new lock written
  })

  it('isLocked returns false after process dies (stale lock recovery)', async () => {
    mkdirSync(join(dir, '.barf'), { recursive: true })
    writeFileSync(
      join(dir, '.barf', '001.lock'),
      JSON.stringify({
        pid: 999999999,
        acquiredAt: new Date().toISOString(),
        state: 'IN_PROGRESS',
        mode: 'build'
      })
    )
    const result = await provider.isLocked('001')
    expect(result._unsafeUnwrap()).toBe(false)
    expect(existsSync(join(dir, '.barf', '001.lock'))).toBe(false)
  })

  it('deletes an issue file', async () => {
    await provider.deleteIssue('001')
    expect(existsSync(join(dir, 'issues', '001.md'))).toBe(false)
  })

  it('deleteIssue succeeds even if file does not exist', async () => {
    const result = await provider.deleteIssue('999')
    expect(result.isOk()).toBe(true)
  })

  it('issue file is never renamed to .working', async () => {
    await provider.lockIssue('001')
    expect(existsSync(join(dir, 'issues', '001.md'))).toBe(true)
    expect(existsSync(join(dir, 'issues', '001.md.working'))).toBe(false)
  })
})
