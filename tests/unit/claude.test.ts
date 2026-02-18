import { describe, it, expect } from 'bun:test';
import { getThreshold } from '../../src/core/claude';

// runClaudeIteration spawns a real subprocess — tested in tests/integration/
// getThreshold is the only pure function to unit test here.

describe('getThreshold', () => {
  it('computes 75% of 200000 = 150000 for sonnet', () => {
    expect(getThreshold('claude-sonnet-4-6', 75)).toBe(150_000);
  });

  it('computes 50% of 200000 = 100000 for opus', () => {
    expect(getThreshold('claude-opus-4-6', 50)).toBe(100_000);
  });

  it('uses 200000 as default limit for unknown models', () => {
    expect(getThreshold('unknown-model-xyz', 80)).toBe(160_000);
  });

  it('handles 100% threshold', () => {
    expect(getThreshold('claude-sonnet-4-6', 100)).toBe(200_000);
  });
});
