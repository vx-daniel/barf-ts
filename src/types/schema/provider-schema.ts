/** @module Configuration */
import { z } from 'zod'

/** Default sampling temperature for audit providers. */
export const DEFAULT_TEMPERATURE = 0.2

/**
 * Intermediate token usage extracted by each provider's `parseResponse`.
 * All counts default to 0 — providers that omit usage data are safe.
 *
 * @category Providers
 */
export const TokenUsageSchema = z.object({
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  totalTokens: z.number().default(0),
})
/** Derived from {@link TokenUsageSchema}. */
export type TokenUsage = z.infer<typeof TokenUsageSchema>

/**
 * Canonical output returned by any AuditProvider's `chat` method.
 * All callers depend on this shape, never on provider-specific response objects.
 *
 * @category Providers
 */
export const ChatResultSchema = z.object({
  content: z.string(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
})
/** Derived from {@link ChatResultSchema}. */
export type ChatResult = z.infer<typeof ChatResultSchema>

/**
 * Options accepted by `chat` and `chatJSON`. All fields are optional.
 * `jsonMode` enables provider-native structured JSON output.
 *
 * @category Providers
 */
export const ChatOptionsSchema = z.object({
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  jsonMode: z.boolean().optional(),
})
/** Derived from {@link ChatOptionsSchema}. */
export type ChatOptions = z.infer<typeof ChatOptionsSchema>

/**
 * Result returned by AuditProvider.ping.
 *
 * @category Providers
 */
export const PingResultSchema = z.object({
  latencyMs: z.number(),
  model: z.string(),
})
/** Derived from {@link PingResultSchema}. */
export type PingResult = z.infer<typeof PingResultSchema>

/**
 * Tier classification for a model: `small` = fast/cheap, `general` = balanced, `frontier` = high quality/cost.
 *
 * @category Providers
 */
export const ModelTierSchema = z.enum(['small', 'general', 'frontier'])
/** Derived from {@link ModelTierSchema}. */
export type ModelTier = z.infer<typeof ModelTierSchema>

/**
 * Annotated model entry returned by `AuditProvider.listModels`.
 *
 * @category Providers
 */
export const ModelInfoSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  tier: ModelTierSchema,
})
/** Derived from {@link ModelInfoSchema}. */
export type ModelInfo = z.infer<typeof ModelInfoSchema>

/**
 * Static metadata about a provider. Returned by AuditProvider.describe.
 * No network call required — used for error messages and config validation.
 *
 * @category Providers
 */
export const ProviderInfoSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  requiredConfigKeys: z.array(z.string()),
  supportedModels: z.array(z.string()),
})
/** Derived from {@link ProviderInfoSchema}. */
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>

/**
 * Constructs a {@link TokenUsage} from optional raw API token counts.
 * All fields default to 0; `totalTokens` defaults to `prompt + completion`
 * when the API omits it (e.g. Anthropic Messages API).
 *
 * @param prompt - Raw prompt token count from the API response
 * @param completion - Raw completion token count from the API response
 * @param total - Raw total token count; defaults to `prompt + completion` when absent
 * @returns Fully-populated {@link TokenUsage} with no optional fields
 */
export function toTokenUsage(
  prompt?: number | null,
  completion?: number | null,
  total?: number | null,
): TokenUsage {
  const p = prompt ?? 0
  const c = completion ?? 0
  return {
    promptTokens: p,
    completionTokens: c,
    totalTokens: total ?? p + c,
  }
}
