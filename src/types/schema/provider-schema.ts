import { z } from 'zod'

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
