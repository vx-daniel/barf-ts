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

export type { OverflowDecision } from '@/types/schema/batch-schema'
export type { LoopMode } from '@/types/schema/mode-schema'
export {
  cancelAuditGate,
  checkAutoTrigger,
  incrementCompleted,
  readAuditGate,
  resetAuditGate,
  transitionToAuditing,
  transitionToFixing,
  triggerAuditGate,
  writeAuditGate,
} from './audit-gate'
export { handleOverflow, resolveIssueFile, shouldContinue } from './helpers'
export { createLimiter, type Limiter } from './limiter'
export { type RunLoopDeps, runLoop } from './loop'
export {
  makeAutoSessionId,
  makeSessionId,
  writeAuditGateEvent,
  writeAutoEnd,
  writeAutoStart,
  writeSessionArchive,
  writeSessionDelete,
  writeSessionEnd,
  writeSessionStart,
} from './session-index'
