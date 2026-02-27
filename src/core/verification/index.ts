/**
 * Verification module — public API for post-completion verification.
 *
 * @module Verification
 */

export {
  DEFAULT_VERIFY_CHECKS,
  type ExecFn,
  runVerification,
  type VerifyCheck,
  type VerifyFailure,
  type VerifyResult,
} from './checks'
export { buildFixBody } from './format'
export { verifyIssue } from './orchestration'
