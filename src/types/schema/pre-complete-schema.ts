/**
 * Pre-completion schemas — data structures for the pre-complete gate.
 *
 * Before marking an issue as COMPLETED, barf runs fix commands (best-effort)
 * and a test gate (hard requirement). These schemas define the fix step
 * definitions and the outcome of the pre-completion checks.
 *
 * @module Configuration
 */
import { z } from 'zod'

/**
 * A fix command to run before testing.
 *
 * Fix steps are derived from the `fixCommands` config array. Each command
 * is run via `sh -c` before the test gate. Failures are logged but do not
 * block — they are best-effort cleanup (e.g. auto-formatting, lint --fix).
 *
 * @category Pre-Completion
 */
export const FixStepSchema = z.object({
  /** Human-readable name for this step (derived from first word of command). */
  name: z.string(),
  /** Shell command to execute via `sh -c`. */
  command: z.string(),
})

/**
 * A fix step definition. Derived from {@link FixStepSchema}.
 *
 * @category Pre-Completion
 */
export type FixStep = z.infer<typeof FixStepSchema>

/**
 * Outcome of the pre-completion checks.
 *
 * Uses a discriminated union on the `passed` field:
 * - `{ passed: true }` — all fix steps ran and test gate passed (or was skipped)
 * - `{ passed: false, testFailure }` — the test gate command failed, with output details
 *
 * @category Pre-Completion
 */
export const PreCompleteResultSchema = z.discriminatedUnion('passed', [
  z.object({ passed: z.literal(true) }),
  z.object({
    passed: z.literal(false),
    testFailure: z.object({
      /** Standard output from the failed test command. */
      stdout: z.string(),
      /** Standard error from the failed test command. */
      stderr: z.string(),
      /** Process exit code of the failed test command. */
      exitCode: z.number().int(),
    }),
  }),
])

/**
 * Pre-completion outcome. Derived from {@link PreCompleteResultSchema}.
 *
 * @category Pre-Completion
 */
export type PreCompleteResult = z.infer<typeof PreCompleteResultSchema>
