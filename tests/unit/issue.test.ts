import { describe, it, expect } from 'bun:test'
import {
  parseIssue,
  serializeIssue,
  validateTransition,
  parseAcceptanceCriteria
} from '@/core/issue'
import { InvalidTransitionError } from '@/types'

const SAMPLE = `---
id=001
title=My Issue
state=NEW
parent=
children=
split_count=0
---

## Description
Hello world

## Acceptance Criteria
- [x] Done thing
- [ ] Not done thing
`

describe('parseIssue', () => {
  it('parses all frontmatter fields', () => {
    const result = parseIssue(SAMPLE)
    expect(result.isOk()).toBe(true)
    const issue = result._unsafeUnwrap()
    expect(issue.id).toBe('001')
    expect(issue.title).toBe('My Issue')
    expect(issue.state).toBe('NEW')
    expect(issue.parent).toBe('')
    expect(issue.children).toEqual([])
    expect(issue.split_count).toBe(0)
  })

  it('parses children as array', () => {
    const issue = parseIssue(SAMPLE.replace('children=', 'children=001-1,001-2'))._unsafeUnwrap()
    expect(issue.children).toEqual(['001-1', '001-2'])
  })

  it('preserves body content', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(issue.body).toContain('## Description')
    expect(issue.body).toContain('Hello world')
  })

  it('returns Err on missing frontmatter', () => {
    expect(parseIssue('no frontmatter here').isErr()).toBe(true)
  })

  it('returns Err on invalid state value', () => {
    expect(parseIssue(SAMPLE.replace('state=NEW', 'state=BOGUS')).isErr()).toBe(true)
  })
})

describe('serializeIssue / parseIssue round-trip', () => {
  it('round-trips without data loss', () => {
    const original = parseIssue(SAMPLE)._unsafeUnwrap()
    const reparsed = parseIssue(serializeIssue(original))._unsafeUnwrap()
    expect(reparsed.id).toBe(original.id)
    expect(reparsed.state).toBe(original.state)
    expect(reparsed.children).toEqual(original.children)
  })
})

describe('validateTransition', () => {
  it('returns Ok for valid transition NEW → PLANNED', () => {
    expect(validateTransition('NEW', 'PLANNED').isOk()).toBe(true)
  })

  it('returns Err(InvalidTransitionError) for invalid transition', () => {
    const result = validateTransition('NEW', 'COMPLETED')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(InvalidTransitionError)
  })

  it('returns Err for transition from terminal COMPLETED state', () => {
    expect(validateTransition('COMPLETED', 'PLANNED').isErr()).toBe(true)
  })
})

describe('parseAcceptanceCriteria', () => {
  it('returns false when any criteria unchecked', () => {
    expect(parseAcceptanceCriteria(SAMPLE)).toBe(false)
  })

  it('returns true when all criteria checked', () => {
    const allDone = SAMPLE.replace('- [ ] Not done thing', '- [x] Not done thing')
    expect(parseAcceptanceCriteria(allDone)).toBe(true)
  })

  it('returns true when no Acceptance Criteria section exists', () => {
    expect(parseAcceptanceCriteria('no criteria here')).toBe(true)
  })
})
