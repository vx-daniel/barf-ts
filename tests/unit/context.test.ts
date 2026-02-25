import { describe, it, expect } from 'bun:test'
import { injectTemplateVars } from '@/core/context'

describe('injectTemplateVars', () => {
  const vars = {
    BARF_ISSUE_ID: '001',
    BARF_ISSUE_FILE: 'issues/001.md.working',
    BARF_MODE: 'build',
    BARF_ITERATION: 2,
    ISSUES_DIR: 'issues',
    PLAN_DIR: 'plans',
  }

  it('replaces $BARF_ISSUE_ID', () => {
    expect(injectTemplateVars('id: $BARF_ISSUE_ID', vars)).toBe('id: 001')
  })

  // eslint-disable-next-line no-template-curly-in-string
  it('replaces ${BARF_ISSUE_ID} (braced form)', () => {
    // eslint-disable-next-line no-template-curly-in-string
    expect(injectTemplateVars('id: ${BARF_ISSUE_ID}', vars)).toBe('id: 001')
  })

  it('replaces all six variables', () => {
    const t =
      '$BARF_ISSUE_ID $BARF_ISSUE_FILE $BARF_MODE $BARF_ITERATION $ISSUES_DIR $PLAN_DIR'
    expect(injectTemplateVars(t, vars)).toBe(
      '001 issues/001.md.working build 2 issues plans',
    )
  })

  it('replaces multiple occurrences of the same variable', () => {
    expect(injectTemplateVars('$BARF_ISSUE_ID $BARF_ISSUE_ID', vars)).toBe(
      '001 001',
    )
  })
})
