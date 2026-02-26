/**
 * Verification schemas — data structures for post-completion verification checks.
 *
 * After an issue reaches COMPLETED, barf runs automated verification (build,
 * lint, test) to confirm the work is correct before transitioning to VERIFIED.
 * These schemas define the check definitions and their outcomes.
 *
 * @module verification-schema
 */
import { z } from 'zod'

/**
 * A single verification check to run.
 *
 * Each check is a command with arguments that barf executes sequentially.
 * The default checks mirror the `/verify` command: build → format+lint → test suite.
 *
 * @category Verification
 */
export const VerifyCheckSchema = z.object({
  /** Human-readable name for this check (e.g. `'build'`, `'check'`, `'test'`). */
  name: z.string(),
  /** Executable command to run (e.g. `'bun'`). */
  command: z.string(),
  /** Arguments passed to the command (e.g. `['run', 'build']`). */
  args: z.array(z.string()),
})

/**
 * A single verification check definition. Derived from {@link VerifyCheckSchema}.
 *
 * @category Verification
 */
export type VerifyCheck = z.infer<typeof VerifyCheckSchema>

/**
 * Result of a single failed verification check.
 *
 * Captures the check name, stdout/stderr output, and exit code so that
 * fix sub-issues can include detailed failure information in their body.
 *
 * @category Verification
 */
export const VerifyFailureSchema = z.object({
  /** Name of the check that failed. */
  check: z.string(),
  /** Standard output from the failed command. */
  stdout: z.string(),
  /** Standard error from the failed command. */
  stderr: z.string(),
  /** Process exit code (non-zero indicates failure). */
  exitCode: z.number().int(),
})

/**
 * A single verification failure record. Derived from {@link VerifyFailureSchema}.
 *
 * @category Verification
 */
export type VerifyFailure = z.infer<typeof VerifyFailureSchema>

/**
 * Outcome of running all verification checks.
 *
 * Uses a discriminated union on the `passed` field:
 * - `{ passed: true }` — all checks succeeded, issue can transition to VERIFIED
 * - `{ passed: false, failures }` — one or more checks failed, with details
 *
 * @category Verification
 */
export const VerifyResultSchema = z.discriminatedUnion('passed', [
  z.object({ passed: z.literal(true) }),
  z.object({
    passed: z.literal(false),
    failures: z.array(VerifyFailureSchema),
  }),
])

/**
 * Verification outcome. Derived from {@link VerifyResultSchema}.
 *
 * @category Verification
 */
export type VerifyResult = z.infer<typeof VerifyResultSchema>
