import { describe, it, expect } from 'bun:test'
import { IterationOutcomeSchema, IterationResultSchema } from '@/types/schema/claude-schema'

describe('IterationOutcomeSchema', () => {
  it.each(['success', 'overflow', 'error', 'rate_limited'])('accepts "%s"', outcome => {
    expect(IterationOutcomeSchema.safeParse(outcome).success).toBe(true)
  })

  it('rejects invalid outcome', () => {
    expect(IterationOutcomeSchema.safeParse('timeout').success).toBe(false)
  })
})

describe('IterationResultSchema', () => {
  it('parses a valid result without rateLimitResetsAt', () => {
    const result = IterationResultSchema.safeParse({ outcome: 'success', tokens: 1500 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ outcome: 'success', tokens: 1500 })
    }
  })

  it('parses a rate-limited result with rateLimitResetsAt', () => {
    const input = { outcome: 'rate_limited', tokens: 800, rateLimitResetsAt: 1700000000 }
    const result = IterationResultSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rateLimitResetsAt).toBe(1700000000)
    }
  })

  it('rejects missing outcome', () => {
    expect(IterationResultSchema.safeParse({ tokens: 100 }).success).toBe(false)
  })

  it('rejects missing tokens', () => {
    expect(IterationResultSchema.safeParse({ outcome: 'success' }).success).toBe(false)
  })
})
