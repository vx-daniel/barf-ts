/**
 * Verification orchestration — post-COMPLETED verification workflow.
 *
 * After an issue reaches COMPLETED, this module orchestrates the verification
 * flow: run checks, and based on the outcome either transition to VERIFIED,
 * create a fix sub-issue, or mark the issue as verify-exhausted.
 *
 * @module Verification
 */
import { ResultAsync } from 'neverthrow'
import type { Config } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import { type ExecFn, DEFAULT_VERIFY_CHECKS, runVerification } from './checks'
import { buildFixBody } from './format'

const logger = createLogger('verification')

/**
 * Runs verification for an issue after it reaches COMPLETED.
 *
 * The verification workflow has three possible outcomes:
 *
 * 1. **All checks pass** → transition to VERIFIED (terminal state)
 * 2. **Checks fail, retries remaining** → create a fix sub-issue with failure
 *    details, increment `verify_count` on the parent
 * 3. **Checks fail, retries exhausted** → set `verify_exhausted=true`, leave
 *    as COMPLETED (no further automatic attempts)
 *
 * Issues with `is_verify_fix=true` are skipped to prevent recursive verification
 * of issues that were themselves created to fix parent verification failures.
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
  deps?: { execFn?: ExecFn },
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
      logger.info(
        { issueId },
        'verification passed — transitioning to VERIFIED',
      )
      const transitionResult = await provider.transition(
        issueId,
        'VERIFIED',
        {
          durationInStageSeconds: 0,
          inputTokens: 0,
          outputTokens: 0,
          finalContextSize: 0,
          iterations: 0,
          model: '',
          trigger: 'auto/verify',
        },
      )
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
        'verify retries exhausted — leaving as COMPLETED',
      )
      const writeResult = await provider.writeIssue(issueId, {
        verify_exhausted: true,
      })
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
      parent: issueId,
    })
    if (createResult.isErr()) {
      throw createResult.error
    }

    const fixIssue = createResult.value
    logger.info(
      { issueId, fixIssueId: fixIssue.id },
      'created fix sub-issue for verify failure',
    )

    // Mark fix child so it is not re-verified
    const markFixResult = await provider.writeIssue(fixIssue.id, {
      is_verify_fix: true,
    })
    if (markFixResult.isErr()) {
      throw markFixResult.error
    }

    // Increment verify_count on parent
    const incrementResult = await provider.writeIssue(issueId, {
      verify_count: verifyCount + 1,
    })
    if (incrementResult.isErr()) {
      throw incrementResult.error
    }
  }

  return ResultAsync.fromPromise(run(), toError)
}
