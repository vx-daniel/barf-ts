import { describe, it, expect } from 'bun:test'
import {
  inferTier,
  prettifyModelId,
  OPENAI_TIERS,
  CLAUDE_TIERS,
  GEMINI_TIERS,
} from '@/providers/model-tiers'

describe('inferTier - provider map lookup', () => {
  it('returns small for gpt-4o-mini via OPENAI_TIERS', () => {
    expect(inferTier('gpt-4o-mini', OPENAI_TIERS)).toBe('small')
  })

  it('returns general for gpt-4o via OPENAI_TIERS', () => {
    expect(inferTier('gpt-4o', OPENAI_TIERS)).toBe('general')
  })

  it('returns frontier for o1 via OPENAI_TIERS', () => {
    expect(inferTier('o1', OPENAI_TIERS)).toBe('frontier')
  })

  it('returns frontier for o3 via OPENAI_TIERS', () => {
    expect(inferTier('o3', OPENAI_TIERS)).toBe('frontier')
  })

  it('returns small for claude-haiku-4-5-20251001 via CLAUDE_TIERS', () => {
    expect(inferTier('claude-haiku-4-5-20251001', CLAUDE_TIERS)).toBe('small')
  })

  it('returns general for claude-sonnet-4-6 via CLAUDE_TIERS', () => {
    expect(inferTier('claude-sonnet-4-6', CLAUDE_TIERS)).toBe('general')
  })

  it('returns frontier for claude-opus-4-6 via CLAUDE_TIERS', () => {
    expect(inferTier('claude-opus-4-6', CLAUDE_TIERS)).toBe('frontier')
  })

  it('returns small for gemini-1.5-flash via GEMINI_TIERS', () => {
    expect(inferTier('gemini-1.5-flash', GEMINI_TIERS)).toBe('small')
  })

  it('returns general for gemini-1.5-pro via GEMINI_TIERS', () => {
    expect(inferTier('gemini-1.5-pro', GEMINI_TIERS)).toBe('general')
  })

  it('returns frontier for gemini-2.5-pro via GEMINI_TIERS', () => {
    expect(inferTier('gemini-2.5-pro', GEMINI_TIERS)).toBe('frontier')
  })

  it('returns frontier for gemini-2.5-flash via GEMINI_TIERS', () => {
    expect(inferTier('gemini-2.5-flash', GEMINI_TIERS)).toBe('frontier')
  })
})

describe('inferTier - keyword fallback (no provider map)', () => {
  it('returns small for model containing "mini"', () => {
    expect(inferTier('some-mini-model')).toBe('small')
  })

  it('returns small for model containing "flash"', () => {
    expect(inferTier('gemini-flash-exp')).toBe('small')
  })

  it('returns small for model containing "haiku"', () => {
    expect(inferTier('claude-haiku-new')).toBe('small')
  })

  it('returns small for model containing "lite"', () => {
    expect(inferTier('gemini-lite-v1')).toBe('small')
  })

  it('returns small for model containing "nano"', () => {
    expect(inferTier('model-nano')).toBe('small')
  })

  it('returns small for model containing "fast"', () => {
    expect(inferTier('fast-model-v1')).toBe('small')
  })

  it('returns frontier for model containing "opus"', () => {
    expect(inferTier('claude-opus-new')).toBe('frontier')
  })

  it('returns frontier for model containing "ultra"', () => {
    expect(inferTier('gemini-ultra')).toBe('frontier')
  })

  it('returns frontier for model containing "thinking"', () => {
    expect(inferTier('claude-3-thinking')).toBe('frontier')
  })

  it('returns general for unknown model', () => {
    expect(inferTier('some-unknown-model-v2')).toBe('general')
  })

  it('returns general when provider map is provided but model not in map', () => {
    expect(inferTier('unknown-model', OPENAI_TIERS)).toBe('general')
  })
})

describe('inferTier - o1/o3 mini edge cases', () => {
  it('returns small for o4-mini via OPENAI_TIERS', () => {
    expect(inferTier('o4-mini', OPENAI_TIERS)).toBe('small')
  })

  it('returns small for o1-mini via keyword fallback (has "mini")', () => {
    // o1-mini matches /mini/ before frontier regex
    expect(inferTier('o1-mini')).toBe('small')
  })

  it('returns small for o3-mini via keyword fallback (has "mini")', () => {
    expect(inferTier('o3-mini')).toBe('small')
  })
})

describe('prettifyModelId', () => {
  it('capitalizes first letter', () => {
    expect(prettifyModelId('gpt-4o')[0]).toBe('G')
  })

  it('replaces hyphens with spaces', () => {
    expect(prettifyModelId('gpt-4o-mini')).toBe('Gpt 4o mini')
  })

  it('handles single-word model IDs', () => {
    expect(prettifyModelId('codex')).toBe('Codex')
  })
})
