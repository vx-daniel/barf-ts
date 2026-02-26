/**
 * Domain error classes — typed errors for barf's core operations.
 *
 * Barf uses neverthrow's `Result`/`ResultAsync` for error handling throughout
 * the codebase, so these errors appear in `err()` values rather than being
 * thrown. The one exception is at the CLI boundary (`src/index.ts`) where
 * errors are caught and displayed to the user.
 *
 * @module Configuration
 */
import type { IssueState } from '@/types/schema/issue-schema'

/**
 * Thrown by `validateTransition` when a state change is not permitted
 * by the `IssueStateSchema` state machine.
 *
 * The state machine defines which transitions are valid (e.g. `NEW → PLANNED`
 * is valid, but `NEW → VERIFIED` is not). This error provides a clear message
 * showing the attempted transition so developers can trace where the invalid
 * state change originated.
 *
 * @category Issue Model
 * @group Issue
 */
export class InvalidTransitionError extends Error {
  constructor(from: IssueState, to: IssueState) {
    super(`Invalid transition: ${from} → ${to}`)
    this.name = 'InvalidTransitionError'
  }
}

/**
 * Wraps I/O errors from issue provider operations (local filesystem or GitHub).
 *
 * Provider operations (fetch, write, lock, unlock, etc.) can fail due to
 * filesystem errors, network issues, or API failures. This error wraps
 * the underlying cause and provides a human-readable message describing
 * which operation failed.
 *
 * The optional `cause` field preserves the original error for debugging
 * while the `message` provides context about what barf was trying to do.
 *
 * @category Issue Providers
 * @group Issue
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
