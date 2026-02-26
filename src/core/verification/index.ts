/**
 * Verification module — public API for post-completion verification.
 *
 * @module verification
 */

export {
  type ExecFn,
  DEFAULT_VERIFY_CHECKS,
  runVerification,
  type VerifyCheck,
  type VerifyFailure,
  type VerifyResult,
} from './checks'
export { verifyIssue } from './orchestration'
export { buildFixBody } from './format'
