/**
 * Verification checks — runs build/lint/test commands and collects results.
 *
 * This module contains the pure verification runner that executes checks
 * sequentially and collects all failures before returning. It never throws —
 * verification failures are represented as data in the return value.
 *
 * @module verification/checks
 */
import { ResultAsync } from 'neverthrow'
import type { VerifyCheck, VerifyFailure, VerifyResult } from '@/types'
import { execFileNoThrow, type ExecResult } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'

export type { VerifyCheck, VerifyFailure, VerifyResult } from '@/types'

/** Injectable subprocess function — mirrors {@link execFileNoThrow}'s signature. */
export type ExecFn = (file: string, args?: string[]) => Promise<ExecResult>

const logger = createLogger('verification')

/**
 * Default checks mirroring the `/verify` command:
 * build → format+lint → test suite.
 *
 * These are the standard verification steps that every barf issue must pass
 * before it can transition from COMPLETED to VERIFIED.
 *
 * @category Verification
 */
export const DEFAULT_VERIFY_CHECKS: VerifyCheck[] = [
  { name: 'build', command: 'bun', args: ['run', 'build'] },
  { name: 'check', command: 'bun', args: ['run', 'check'] },
  { name: 'test', command: 'bun', args: ['test'] },
]

/**
 * Runs each check sequentially, collecting all failures before returning.
 *
 * Never throws — verification failures are represented in the returned value.
 * This makes the function safe to call without try/catch; the caller can
 * inspect the result to decide what to do next.
 *
 * @param checks - List of checks to run; defaults to {@link DEFAULT_VERIFY_CHECKS}.
 * @param execFn - Injectable shell executor (real or mock).
 * @returns `ok({ passed: true })` when all checks pass,
 *   `ok({ passed: false, failures })` when one or more fail.
 * @category Verification
 */
export function runVerification(
  checks: VerifyCheck[] = DEFAULT_VERIFY_CHECKS,
  execFn: ExecFn = execFileNoThrow,
): ResultAsync<VerifyResult, never> {
  const run = async (): Promise<VerifyResult> => {
    const failures: VerifyFailure[] = []
    for (const check of checks) {
      logger.debug({ check: check.name }, 'running verify check')
      const result = await execFn(check.command, check.args)
      if (result.status !== 0) {
        failures.push({
          check: check.name,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.status,
        })
        logger.warn(
          { check: check.name, exitCode: result.status },
          'verify check failed',
        )
      } else {
        logger.debug({ check: check.name }, 'verify check passed')
      }
    }
    return failures.length === 0
      ? { passed: true }
      : { passed: false, failures }
  }

  // fromSafePromise: the inner async fn never throws
  return ResultAsync.fromSafePromise(run())
}
