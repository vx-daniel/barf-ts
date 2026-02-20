import { describe, it, expect } from 'bun:test'
import { OverflowDecisionSchema } from '@/types/schema/batch-schema'

describe('OverflowDecisionSchema', () => {
  it('parses a split decision', () => {
    const result = OverflowDecisionSchema.safeParse({
      action: 'split',
      nextModel: 'claude-sonnet-4-6'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe('split')
    }
  })

  it('parses an escalate decision', () => {
    const result = OverflowDecisionSchema.safeParse({
      action: 'escalate',
      nextModel: 'claude-opus-4-6'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.action).toBe('escalate')
    }
  })

  it('rejects invalid action', () => {
    expect(
      OverflowDecisionSchema.safeParse({ action: 'retry', nextModel: 'x' }).success
    ).toBe(false)
  })

  it('rejects empty nextModel', () => {
    expect(
      OverflowDecisionSchema.safeParse({ action: 'split', nextModel: '' }).success
    ).toBe(false)
  })

  it('rejects missing nextModel', () => {
    expect(
      OverflowDecisionSchema.safeParse({ action: 'split' }).success
    ).toBe(false)
  })
})
