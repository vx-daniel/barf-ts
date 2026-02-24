import { ResultAsync } from 'neverthrow'
import type { Config } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { execFileNoThrow, type ExecResult } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

/** Injectable subprocess function — mirrors {@link execFileNoThrow}'s signature. */
export type ExecFn = (file: string, args?: string[]) => Promise<ExecResult>

const logger = createLogger('verification')

/** A single verification check to run. */
export interface VerifyCheck {
  name: string
  command: string
  args: string[]
}

/** Result of a single failed check. */
export interface VerifyFailure {
  check: string
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Outcome of running all verification checks.
 * Either all passed, or at least one failed (with details).
 */
export type VerifyResult = { passed: true } | { passed: false; failures: VerifyFailure[] }

/**
 * Default checks mirroring the `/verify` command:
 * build → format+lint → test suite.
 *
 * @category Verification
 */
export const DEFAULT_VERIFY_CHECKS: VerifyCheck[] = [
  { name: 'build', command: 'bun', args: ['run', 'build'] },
  { name: 'check', command: 'bun', args: ['run', 'check'] },
  { name: 'test', command: 'bun', args: ['test'] }
]

/**
 * Runs each check sequentially, collecting all failures before returning.
 * Never throws — verification failures are represented in the returned value.
 *
 * @param checks - List of checks to run; defaults to {@link DEFAULT_VERIFY_CHECKS}.
 * @param execFn - Injectable shell executor (real or mock).
 * @returns `ok({ passed: true })` when all checks pass,
 *   `ok({ passed: false, failures })` when one or more fail.
 * @category Verification
 */
export function runVerification(
  checks: VerifyCheck[] = DEFAULT_VERIFY_CHECKS,
  execFn: ExecFn = execFileNoThrow
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
          exitCode: result.status
        })
        logger.warn({ check: check.name, exitCode: result.status }, 'verify check failed')
      } else {
        logger.debug({ check: check.name }, 'verify check passed')
      }
    }
    return failures.length === 0 ? { passed: true } : { passed: false, failures }
  }

  // fromSafePromise: the inner async fn never throws
  return ResultAsync.fromSafePromise(run())
}

/**
 * Builds the body of a fix sub-issue from the list of verify failures.
 * Each failure section includes the check name and its combined output.
 */
function buildFixBody(issueId: string, failures: VerifyFailure[]): string {
  const sections = failures
    .map(f => {
      const output = [f.stdout, f.stderr].filter(Boolean).join('\n').trim()
      return `### ${f.check}\n\`\`\`\n${output}\n\`\`\``
    })
    .join('\n\n')

  return `## Context
Issue ${issueId} was marked COMPLETED but failed automated verification.

## Failures

${sections}

## Acceptance Criteria
- [ ] \`bun run build\` passes
- [ ] \`bun run check\` passes (format + lint)
- [ ] \`bun test\` passes`
}

/**
 * Runs verification for an issue after it reaches COMPLETED.
 *
 * - If the issue has `is_verify_fix=true`, returns immediately (avoids recursive verification
 *   of issues created to fix parent failures).
 * - If all checks pass, transitions the issue to `VERIFIED`.
 * - If checks fail and `verify_count < maxVerifyRetries`, creates a fix sub-issue and
 *   increments `verify_count` on the parent.
 * - If `verify_count >= maxVerifyRetries`, sets `verify_exhausted=true` and leaves the
 *   issue as COMPLETED (no further attempts).
 *
 * @param issueId - ID of the COMPLETED issue to verify.
 * @param config - Loaded barf configuration (`maxVerifyRetries` controls retry cap).
 * @param provider - Issue provider for reading, writing, and transitioning issues.
 * @param deps - Injectable dependencies; pass `{ execFn: mockFn }` in tests.
 * @returns `ok(void)` always; side effects are written to the provider.
 * @category Verification
 */
export function verifyIssue(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  deps?: { execFn?: ExecFn }
): ResultAsync<void, Error> {
  const execFn = deps?.execFn ?? execFileNoThrow

  const run = async (): Promise<void> => {
    const fetchResult = await provider.fetchIssue(issueId)
    if (fetchResult.isErr()) {
      throw fetchResult.error
    }

    const issue = fetchResult.value

    // Skip fix-child issues to avoid recursive verification
    if (issue.is_verify_fix === true) {
      logger.debug({ issueId }, 'skipping verify — is_verify_fix issue')
      return
    }

    const verifyResult = await runVerification(DEFAULT_VERIFY_CHECKS, execFn)
    // runVerification never errors, so this is always ok
    const outcome = verifyResult._unsafeUnwrap()

    if (outcome.passed) {
      logger.info({ issueId }, 'verification passed — transitioning to VERIFIED')
      const transitionResult = await provider.transition(issueId, 'VERIFIED')
      if (transitionResult.isErr()) {
        throw transitionResult.error
      }
      return
    }

    // Verification failed — fetch fresh copy to get current verify_count
    const freshResult = await provider.fetchIssue(issueId)
    if (freshResult.isErr()) {
      throw freshResult.error
    }
    const fresh = freshResult.value
    const verifyCount = fresh.verify_count

    if (verifyCount >= config.maxVerifyRetries) {
      logger.warn(
        { issueId, verifyCount, maxVerifyRetries: config.maxVerifyRetries },
        'verify retries exhausted — leaving as COMPLETED'
      )
      const writeResult = await provider.writeIssue(issueId, { verify_exhausted: true })
      if (writeResult.isErr()) {
        throw writeResult.error
      }
      return
    }

    // Create a fix sub-issue
    const fixBody = buildFixBody(issueId, outcome.failures)
    const createResult = await provider.createIssue({
      title: `Fix verification failures: ${issueId}`,
      body: fixBody,
      parent: issueId
    })
    if (createResult.isErr()) {
      throw createResult.error
    }

    const fixIssue = createResult.value
    logger.info({ issueId, fixIssueId: fixIssue.id }, 'created fix sub-issue for verify failure')

    // Mark fix child so it is not re-verified
    const markFixResult = await provider.writeIssue(fixIssue.id, { is_verify_fix: true })
    if (markFixResult.isErr()) {
      throw markFixResult.error
    }

    // Increment verify_count on parent
    const incrementResult = await provider.writeIssue(issueId, { verify_count: verifyCount + 1 })
    if (incrementResult.isErr()) {
      throw incrementResult.error
    }
  }

  return ResultAsync.fromPromise(run(), toError)
}
