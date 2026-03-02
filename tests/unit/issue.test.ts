import { describe, it, expect } from 'bun:test'
import {
  parseIssue,
  serializeIssue,
  validateTransition,
  parseAcceptanceCriteria,
} from '@/core/issue'
import { InvalidTransitionError, ProviderError } from '@/types'

const SAMPLE = `---
id=001
title=My Issue
state=NEW
parent=
children=
split_count=0
force_split=false
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
    expect(issue.force_split).toBe(false)
  })

  it('parses force_split=true', () => {
    const result = parseIssue(
      SAMPLE.replace('force_split=false', 'force_split=true'),
    )
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().force_split).toBe(true)
  })

  it('defaults force_split to false when absent', () => {
    const withoutForceSplit = SAMPLE.replace('force_split=false\n', '')
    const result = parseIssue(withoutForceSplit)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().force_split).toBe(false)
  })

  it('parses children as array', () => {
    const issue = parseIssue(
      SAMPLE.replace('children=', 'children=001-1,001-2'),
    )._unsafeUnwrap()
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
    expect(parseIssue(SAMPLE.replace('state=NEW', 'state=BOGUS')).isErr()).toBe(
      true,
    )
  })
})

describe('context_usage_percent', () => {
  it('parses context_usage_percent=80 correctly', () => {
    const withPercent = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\ncontext_usage_percent=80\n',
    )
    const result = parseIssue(withPercent)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().context_usage_percent).toBe(80)
  })

  it('returns undefined when field absent', () => {
    const result = parseIssue(SAMPLE)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().context_usage_percent).toBeUndefined()
  })

  it('returns undefined when field is empty string', () => {
    const withEmpty = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\ncontext_usage_percent=\n',
    )
    const result = parseIssue(withEmpty)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().context_usage_percent).toBeUndefined()
  })

  it('serializes when present', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    issue.context_usage_percent = 90
    const serialized = serializeIssue(issue)
    expect(serialized).toContain('context_usage_percent=90')
  })

  it('omits when undefined', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(issue.context_usage_percent).toBeUndefined()
    const serialized = serializeIssue(issue)
    expect(serialized).not.toContain('context_usage_percent')
  })

  it('round-trips with value preserved', () => {
    const withPercent = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\ncontext_usage_percent=85\n',
    )
    const original = parseIssue(withPercent)._unsafeUnwrap()
    const reparsed = parseIssue(serializeIssue(original))._unsafeUnwrap()
    expect(reparsed.context_usage_percent).toBe(85)
  })

  it('rejects 0 via Zod min(1)', () => {
    const withZero = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\ncontext_usage_percent=0\n',
    )
    expect(parseIssue(withZero).isErr()).toBe(true)
  })

  it('rejects 101 via Zod max(100)', () => {
    const withOver = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\ncontext_usage_percent=101\n',
    )
    expect(parseIssue(withOver).isErr()).toBe(true)
  })
})

describe('needs_interview', () => {
  it('parses needs_interview=true', () => {
    const issue = parseIssue(
      SAMPLE.replace(
        'force_split=false\n',
        'force_split=false\nneeds_interview=true\n',
      ),
    )._unsafeUnwrap()
    expect(issue.needs_interview).toBe(true)
  })

  it('parses needs_interview=false', () => {
    const issue = parseIssue(
      SAMPLE.replace(
        'force_split=false\n',
        'force_split=false\nneeds_interview=false\n',
      ),
    )._unsafeUnwrap()
    expect(issue.needs_interview).toBe(false)
  })

  it('returns undefined when needs_interview absent', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(issue.needs_interview).toBeUndefined()
  })

  it('serializes needs_interview=true', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    issue.needs_interview = true
    expect(serializeIssue(issue)).toContain('needs_interview=true')
  })

  it('serializes needs_interview=false', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    issue.needs_interview = false
    expect(serializeIssue(issue)).toContain('needs_interview=false')
  })

  it('omits needs_interview when undefined', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(serializeIssue(issue)).not.toContain('needs_interview')
  })

  it('round-trips needs_interview=true', () => {
    const src = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\nneeds_interview=true\n',
    )
    const reparsed = parseIssue(
      serializeIssue(parseIssue(src)._unsafeUnwrap()),
    )._unsafeUnwrap()
    expect(reparsed.needs_interview).toBe(true)
  })
})

describe('serializeIssue / parseIssue round-trip', () => {
  it('round-trips without data loss', () => {
    const original = parseIssue(SAMPLE)._unsafeUnwrap()
    const reparsed = parseIssue(serializeIssue(original))._unsafeUnwrap()
    expect(reparsed.id).toBe(original.id)
    expect(reparsed.state).toBe(original.state)
    expect(reparsed.children).toEqual(original.children)
    expect(reparsed.force_split).toBe(original.force_split)
  })
})

describe('verify_count / is_verify_fix / verify_exhausted', () => {
  it('defaults verify_count=0 when absent', () => {
    const result = parseIssue(SAMPLE)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().verify_count).toBe(0)
  })

  it('parses verify_count=2', () => {
    const src = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\nverify_count=2\n',
    )
    const result = parseIssue(src)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().verify_count).toBe(2)
  })

  it('always serializes verify_count', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(serializeIssue(issue)).toContain('verify_count=0')
  })

  it('round-trips verify_count=5', () => {
    const src = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\nverify_count=5\n',
    )
    const original = parseIssue(src)._unsafeUnwrap()
    const reparsed = parseIssue(serializeIssue(original))._unsafeUnwrap()
    expect(reparsed.verify_count).toBe(5)
  })

  it('parses is_verify_fix=true', () => {
    const src = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\nis_verify_fix=true\n',
    )
    const issue = parseIssue(src)._unsafeUnwrap()
    expect(issue.is_verify_fix).toBe(true)
  })

  it('parses is_verify_fix=false', () => {
    const src = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\nis_verify_fix=false\n',
    )
    const issue = parseIssue(src)._unsafeUnwrap()
    expect(issue.is_verify_fix).toBe(false)
  })

  it('returns undefined for is_verify_fix when absent', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(issue.is_verify_fix).toBeUndefined()
  })

  it('serializes is_verify_fix=true', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    issue.is_verify_fix = true
    expect(serializeIssue(issue)).toContain('is_verify_fix=true')
  })

  it('omits is_verify_fix when undefined', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(serializeIssue(issue)).not.toContain('is_verify_fix')
  })

  it('parses verify_exhausted=true', () => {
    const src = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\nverify_exhausted=true\n',
    )
    const issue = parseIssue(src)._unsafeUnwrap()
    expect(issue.verify_exhausted).toBe(true)
  })

  it('returns undefined for verify_exhausted when absent', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(issue.verify_exhausted).toBeUndefined()
  })

  it('omits verify_exhausted when undefined', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap()
    expect(serializeIssue(issue)).not.toContain('verify_exhausted')
  })

  it('round-trips verify_exhausted=true', () => {
    const src = SAMPLE.replace(
      'force_split=false\n',
      'force_split=false\nverify_exhausted=true\n',
    )
    const original = parseIssue(src)._unsafeUnwrap()
    const reparsed = parseIssue(serializeIssue(original))._unsafeUnwrap()
    expect(reparsed.verify_exhausted).toBe(true)
  })
})

describe('validateTransition', () => {
  it('returns Ok for valid transition NEW → GROOMED', () => {
    expect(validateTransition('NEW', 'GROOMED').isOk()).toBe(true)
  })

  it('returns Ok for valid transition NEW → STUCK', () => {
    expect(validateTransition('NEW', 'STUCK').isOk()).toBe(true)
  })

  it('returns Err for removed transition NEW → PLANNED (must go through GROOMED)', () => {
    expect(validateTransition('NEW', 'PLANNED').isErr()).toBe(true)
  })

  it('returns Ok for valid transition GROOMED → PLANNED', () => {
    expect(validateTransition('GROOMED', 'PLANNED').isOk()).toBe(true)
  })

  it('returns Ok for valid transition GROOMED → STUCK', () => {
    expect(validateTransition('GROOMED', 'STUCK').isOk()).toBe(true)
  })

  it('returns Ok for valid transition GROOMED → SPLIT', () => {
    expect(validateTransition('GROOMED', 'SPLIT').isOk()).toBe(true)
  })

  it('returns Ok for valid transition PLANNED → BUILT', () => {
    expect(validateTransition('PLANNED', 'BUILT').isOk()).toBe(true)
  })

  it('returns Ok for valid transition BUILT → COMPLETE', () => {
    expect(validateTransition('BUILT', 'COMPLETE').isOk()).toBe(true)
  })

  it('returns Ok for valid transition STUCK → GROOMED', () => {
    expect(validateTransition('STUCK', 'GROOMED').isOk()).toBe(true)
  })

  it('returns Err for removed transition NEW → INTERVIEWING', () => {
    // @ts-expect-error — INTERVIEWING is no longer a valid IssueState
    expect(validateTransition('NEW', 'INTERVIEWING').isErr()).toBe(true)
  })

  it('returns Err(InvalidTransitionError) for invalid transition', () => {
    const result = validateTransition('NEW', 'BUILT')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(InvalidTransitionError)
  })

  it('returns Err for transition from terminal COMPLETE state', () => {
    expect(validateTransition('COMPLETE', 'PLANNED').isErr()).toBe(true)
  })

  it('returns Err for BUILT → PLANNED (not a valid transition)', () => {
    expect(validateTransition('BUILT', 'PLANNED').isErr()).toBe(true)
  })
})

describe('parseAcceptanceCriteria', () => {
  it('returns false when any criteria unchecked', () => {
    expect(parseAcceptanceCriteria(SAMPLE)).toBe(false)
  })

  it('returns true when all criteria checked', () => {
    const allDone = SAMPLE.replace(
      '- [ ] Not done thing',
      '- [x] Not done thing',
    )
    expect(parseAcceptanceCriteria(allDone)).toBe(true)
  })

  it('returns true when no Acceptance Criteria section exists', () => {
    expect(parseAcceptanceCriteria('no criteria here')).toBe(true)
  })
})

describe('InvalidTransitionError', () => {
  it('sets message describing the invalid transition', () => {
    const err = new InvalidTransitionError('NEW', 'BUILT')
    expect(err.message).toBe('Invalid transition: NEW → BUILT')
    expect(err.name).toBe('InvalidTransitionError')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('ProviderError', () => {
  it('sets message and name', () => {
    const err = new ProviderError('disk full')
    expect(err.message).toBe('disk full')
    expect(err.name).toBe('ProviderError')
    expect(err).toBeInstanceOf(Error)
  })

  it('stores the cause when provided', () => {
    const cause = new Error('ENOSPC')
    const err = new ProviderError('write failed', cause)
    expect(err.cause).toBe(cause)
  })

  it('works without a cause', () => {
    const err = new ProviderError('something broke')
    expect(err.cause).toBeUndefined()
  })
})
