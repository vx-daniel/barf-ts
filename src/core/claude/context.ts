/**
 * Context window management — model token limits and threshold computation.
 *
 * Barf monitors Claude's context window usage during each iteration to decide
 * when to interrupt (overflow). This module manages the per-model token limits
 * and computes the interrupt threshold from the configured percentage.
 *
 * The token limit registry is mutable so tests can register custom models
 * and new models can be added at runtime without recompilation.
 *
 * @module Orchestration
 */

/**
 * Fallback context-window token limit for models not in the registry.
 *
 * Used when a model identifier isn't found in `MODEL_CONTEXT_LIMITS`.
 * Set to 200,000 tokens which matches current Claude model context windows.
 *
 * @category Claude Agent
 */
export const DEFAULT_CONTEXT_LIMIT = 200_000

/**
 * Mutable registry mapping model identifiers to their context window sizes.
 *
 * Pre-populated with known Claude models. Can be extended at runtime via
 * {@link setContextLimit} for new models or test scenarios.
 */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-opus-4-6': DEFAULT_CONTEXT_LIMIT,
  'claude-sonnet-4-6': DEFAULT_CONTEXT_LIMIT,
  'claude-haiku-4-5-20251001': DEFAULT_CONTEXT_LIMIT,
}

/**
 * Returns the context-window token limit for a given model.
 *
 * Looks up the model in the `MODEL_CONTEXT_LIMITS` registry and
 * falls back to {@link DEFAULT_CONTEXT_LIMIT} for unregistered models.
 *
 * @param model - Claude model identifier string (e.g. `'claude-sonnet-4-6'`).
 * @returns Token limit for the model.
 * @category Claude Agent
 */
export function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] ?? DEFAULT_CONTEXT_LIMIT
}

/**
 * Registers or overrides the context-window token limit for a model.
 *
 * Useful in tests to set up custom models, or for models added after
 * compile time that aren't in the default registry.
 *
 * @param model - Model identifier string.
 * @param limit - Token limit to associate with this model.
 * @category Claude Agent
 */
export function setContextLimit(model: string, limit: number): void {
  MODEL_CONTEXT_LIMITS[model] = limit
}

/**
 * Computes the token threshold at which barf interrupts a Claude session.
 *
 * The formula is: `threshold = floor(contextUsagePercent / 100 × modelLimit)`
 *
 * For example, with a 200,000 token model and 75% usage, the threshold
 * is 150,000 tokens. When cumulative input tokens reach this level,
 * barf interrupts the session and triggers an overflow decision.
 *
 * @param model - Claude model identifier (used to look up the context limit).
 * @param contextUsagePercent - Percentage of context window to use (1-100).
 * @returns Token count at which to interrupt the session.
 * @category Claude Agent
 */
export function getThreshold(
  model: string,
  contextUsagePercent: number,
): number {
  const limit = getContextLimit(model)
  return Math.floor((contextUsagePercent / 100) * limit)
}
