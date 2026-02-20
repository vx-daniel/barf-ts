import { z } from 'zod'

/**
 * Outcome of a single Claude agent iteration.
 * - `success`: iteration completed normally
 * - `overflow`: context threshold exceeded
 * - `error`: Claude exited with a non-success status or timed out
 * - `rate_limited`: API rate limit hit; see `rateLimitResetsAt` for retry time
 *
 * @category Claude Agent
 */
export const IterationOutcomeSchema = z.enum(['success', 'overflow', 'error', 'rate_limited'])
/** An iteration outcome. Derived from {@link IterationOutcomeSchema}. */
export type IterationOutcome = z.infer<typeof IterationOutcomeSchema>

/**
 * Result of a single Claude agent iteration, returned by `runClaudeIteration`.
 *
 * `tokens` is always populated. `rateLimitResetsAt` is set only when
 * `outcome === 'rate_limited'`.
 *
 * @category Claude Agent
 */
export const IterationResultSchema = z.object({
  outcome: IterationOutcomeSchema,
  tokens: z.number(),
  rateLimitResetsAt: z.number().optional()
})
/** A validated iteration result. Derived from {@link IterationResultSchema}. */
export type IterationResult = z.infer<typeof IterationResultSchema>
