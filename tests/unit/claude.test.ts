import { describe, it, expect, afterEach } from 'bun:test'
import { getThreshold, getContextLimit, setContextLimit, DEFAULT_CONTEXT_LIMIT } from '@/core/claude'

// runClaudeIteration spawns a real subprocess — tested in tests/integration/
// getThreshold, getContextLimit, and setContextLimit are the pure functions tested here.

describe('getThreshold', () => {
  it('computes 75% of 200000 = 150000 for sonnet', () => {
    expect(getThreshold('claude-sonnet-4-6', 75)).toBe(150_000)
  })

  it('computes 50% of 200000 = 100000 for opus', () => {
    expect(getThreshold('claude-opus-4-6', 50)).toBe(100_000)
  })

  it('uses 200000 as default limit for unknown models', () => {
    expect(getThreshold('unknown-model-xyz', 80)).toBe(160_000)
  })

  it('handles 100% threshold', () => {
    expect(getThreshold('claude-sonnet-4-6', 100)).toBe(200_000)
  })
})

describe('getContextLimit', () => {
  afterEach(() => {
    // Restore any custom limits set during tests
    setContextLimit('test-model-xyz', DEFAULT_CONTEXT_LIMIT)
  })

  it('returns 200_000 for known model claude-sonnet-4-6', () => {
    expect(getContextLimit('claude-sonnet-4-6')).toBe(200_000)
  })

  it('returns DEFAULT_CONTEXT_LIMIT fallback for unknown model', () => {
    expect(getContextLimit('unknown-model-xyz')).toBe(DEFAULT_CONTEXT_LIMIT)
  })
})

describe('setContextLimit', () => {
  afterEach(() => {
    // Clean up custom registration
    setContextLimit('test-model-xyz', DEFAULT_CONTEXT_LIMIT)
  })

  it('registers a custom limit retrievable by getContextLimit', () => {
    setContextLimit('test-model-xyz', 128_000)
    expect(getContextLimit('test-model-xyz')).toBe(128_000)
  })

  it('overrides existing limit for a known model then restores', () => {
    setContextLimit('claude-haiku-4-5-20251001', 100_000)
    expect(getContextLimit('claude-haiku-4-5-20251001')).toBe(100_000)
    // Restore
    setContextLimit('claude-haiku-4-5-20251001', DEFAULT_CONTEXT_LIMIT)
    expect(getContextLimit('claude-haiku-4-5-20251001')).toBe(DEFAULT_CONTEXT_LIMIT)
  })
})
