/**
 * Claude integration module — public API for running Claude iterations.
 *
 * This barrel re-exports the key functions and types that consumers need.
 * Internal implementation details (display formatting, stream processing)
 * are not exported from this barrel — they are implementation details.
 *
 * @module Orchestration
 */

export {
  DEFAULT_CONTEXT_LIMIT,
  getContextLimit,
  setContextLimit,
  getThreshold,
} from './context'
export { consumeSDKQuery } from './stream'
export { runClaudeIteration } from './iteration'
export type {
  IterationOutcome,
  IterationResult,
} from '@/types/schema/claude-schema'
