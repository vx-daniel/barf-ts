import type { ModelTier } from '@/types/schema/provider-schema'

/**
 * Per-provider static tier maps keyed by model ID.
 * These entries take precedence over the keyword-based {@link inferTier} fallback.
 *
 * @category Providers
 */
export const OPENAI_TIERS: Record<string, ModelTier> = {
  'gpt-4o-mini': 'small',
  'gpt-4.1-mini': 'small',
  'o4-mini': 'small',
  'gpt-4o': 'general',
  'gpt-4.1': 'general',
  'gpt-4-turbo': 'frontier',
  o1: 'frontier',
  o3: 'frontier',
  'gpt-4.5': 'frontier'
}

/**
 * Static tier map for Anthropic Claude models.
 * Haiku = small, Sonnet = general, Opus = frontier.
 *
 * @category Providers
 */
export const CLAUDE_TIERS: Record<string, ModelTier> = {
  'claude-haiku-4-5-20251001': 'small',
  'claude-haiku-4-5': 'small',
  'claude-sonnet-4-5': 'general',
  'claude-sonnet-4-6': 'general',
  'claude-opus-4-5': 'frontier',
  'claude-opus-4-6': 'frontier'
}

/**
 * Static tier map for Google Gemini models.
 * Flash (non-2.5) = small, 1.5-pro/2.0-flash = general, 2.5 models = frontier.
 *
 * @category Providers
 */
export const GEMINI_TIERS: Record<string, ModelTier> = {
  'gemini-1.5-flash': 'small',
  'gemini-1.5-flash-8b': 'small',
  'gemini-1.5-pro': 'general',
  'gemini-2.0-flash': 'general',
  'gemini-2.0-flash-lite': 'small',
  'gemini-2.5-pro': 'frontier',
  'gemini-2.5-flash': 'frontier'
}

/**
 * Infers a {@link ModelTier} for a given model ID.
 * Looks up `providerMap` first; falls back to keyword heuristics on the model ID.
 *
 * The keyword fallback covers:
 * - `small`: contains `\bmini`, `flash`, `haiku`, `lite`, `nano`, or `fast` (word-boundary before `mini` prevents false-matching `gemini`)
 * - `frontier`: matches `opus`, `ultra`, `o1` (not `o1-mini`), `o3` (not `o3-mini`), or `thinking`
 * - `general`: everything else
 *
 * @param modelId - The model identifier to classify.
 * @param providerMap - Optional per-provider lookup table (e.g. {@link OPENAI_TIERS}).
 * @returns The inferred tier for the model.
 */
export function inferTier(modelId: string, providerMap?: Record<string, ModelTier>): ModelTier {
  if (providerMap?.[modelId]) {
    return providerMap[modelId]
  }
  const id = modelId.toLowerCase()
  if (/\bmini|flash|haiku|lite|nano|fast/.test(id)) {
    return 'small'
  }
  if (/opus|ultra|o1(?!-mini)|o3(?!-mini)|thinking/.test(id)) {
    return 'frontier'
  }
  return 'general'
}

/**
 * Converts a model ID string into a human-readable display name.
 * Capitalizes the first letter and replaces hyphens with spaces.
 *
 * @param id - Raw model identifier (e.g. `"gpt-4o-mini"`).
 * @returns Display-friendly string (e.g. `"Gpt 4o mini"`).
 */
export function prettifyModelId(id: string): string {
  const spaced = id.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
