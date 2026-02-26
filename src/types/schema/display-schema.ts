/**
 * Display context schema — contextual fields for TTY progress rendering.
 *
 * The display context is passed through the orchestration stack to enable
 * the sticky 2-line TTY header shown during Claude iterations. It identifies
 * what mode is running, which issue is being processed, and the current state.
 *
 * @module display-schema
 */
import { z } from 'zod'

/**
 * Contextual fields rendered in the 2-line sticky TTY header during a Claude iteration.
 *
 * Passed to `runClaudeIteration` and `triageIssue` to identify what is running.
 * The header line looks like:
 * ```
 * ▶ build  ISSUE-123  IN_PROGRESS  Fix the login bug
 * ```
 *
 * @category Display
 */
export const DisplayContextSchema = z.object({
  /** Command or loop mode being executed (e.g. `'plan'`, `'build'`, `'triage'`). */
  mode: z.string(),
  /** Issue ID being processed. */
  issueId: z.string(),
  /** Current issue state at the time of the call. */
  state: z.string(),
  /** Issue title (truncated to 50 chars before display). */
  title: z.string(),
})

/**
 * Validated display context. Derived from {@link DisplayContextSchema}.
 *
 * @category Display
 */
export type DisplayContext = z.infer<typeof DisplayContextSchema>
