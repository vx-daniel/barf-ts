/**
 * Claude integration module — public API for running Claude iterations.
 *
 * This barrel re-exports the key functions and types that consumers need.
 * Internal implementation details (display formatting, stream processing)
 * are not exported from this barrel — they are implementation details.
 *
 * @module Orchestration
 */

export type {
  IterationOutcome,
  IterationResult,
} from '@/types/schema/claude-schema'
export {
  DEFAULT_CONTEXT_LIMIT,
  getContextLimit,
  getThreshold,
  setContextLimit,
} from './context'
export { runClaudeIteration } from './iteration'
export { consumeSDKQuery } from './stream'
