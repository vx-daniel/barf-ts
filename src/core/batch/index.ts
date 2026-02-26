/**
 * Batch orchestration module — public API for the issue processing loop.
 *
 * This barrel re-exports the key functions and types that consumers need.
 * Internal implementation details (loop state, outcome handlers, stats
 * persistence) are not exported — they are implementation details of the
 * orchestration loop.
 *
 * @module Orchestration
 */

export { runLoop, type RunLoopDeps } from './loop'
export { shouldContinue, handleOverflow, resolveIssueFile } from './helpers'
export type { OverflowDecision } from '@/types/schema/batch-schema'
export type { LoopMode } from '@/types/schema/mode-schema'
