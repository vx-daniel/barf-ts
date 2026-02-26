/** @module Configuration */
import { z } from 'zod'

/**
 * The decision taken by `handleOverflow` when Claude's context fills up.
 * - `split`: decompose the issue into sub-issues using `splitModel`
 * - `escalate`: retry with `extendedContextModel` (larger context window)
 *
 * @category Orchestration
 */
export const OverflowDecisionSchema = z.object({
  action: z.enum(['split', 'escalate']),
  nextModel: z.string().min(1),
})
/** A validated overflow decision. Derived from {@link OverflowDecisionSchema}. */
export type OverflowDecision = z.infer<typeof OverflowDecisionSchema>
