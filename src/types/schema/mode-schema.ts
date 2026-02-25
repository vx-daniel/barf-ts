import { z } from 'zod'

/**
 * Superset of all barf operational modes.
 *
 * Narrower subsets are derived via `.extract()` for type-safe context-specific usage.
 *
 * @category Modes
 */
export const BarfModeSchema = z.enum(['plan', 'build', 'split'])
/** A barf operational mode. Derived from {@link BarfModeSchema}. */
export type BarfMode = z.infer<typeof BarfModeSchema>

/**
 * Modes used by the batch orchestration loop (`runLoop`) and POSIX locking.
 *
 * `'split'` is used internally after an overflow decision.
 *
 * @category Modes
 */
export const LoopModeSchema = BarfModeSchema.extract(['plan', 'build', 'split'])
/** A loop/lock mode. Derived from {@link LoopModeSchema}. */
export type LoopMode = z.infer<typeof LoopModeSchema>

/**
 * Modes accepted by `resolvePromptTemplate` — plan, build, split, audit, triage.
 *
 * Decoupled from {@link BarfModeSchema} so prompt resolution can support modes
 * (audit, triage) that are not part of the batch orchestration loop.
 *
 * @category Modes
 */
export const PromptModeSchema = z.enum([
  'plan',
  'build',
  'split',
  'audit',
  'triage',
])
/** A prompt resolution mode. Derived from {@link PromptModeSchema}. */
export type PromptMode = z.infer<typeof PromptModeSchema>

/**
 * Modes used by `IssueProvider.autoSelect` to pick the next issue.
 *
 * `'split'` is excluded because split issues are handled internally by the loop.
 *
 * @category Modes
 */
export const AutoSelectModeSchema = BarfModeSchema.extract(['plan', 'build'])
/** An auto-select mode. Derived from {@link AutoSelectModeSchema}. */
export type AutoSelectMode = z.infer<typeof AutoSelectModeSchema>
