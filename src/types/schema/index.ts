/**
 * Schema barrel — re-exports all Zod schemas and their inferred types.
 *
 * This is the single entry point for importing schema types throughout the
 * codebase. All Zod schemas live in this directory (`src/types/schema/`)
 * and are re-exported here for convenience.
 *
 * @module Configuration
 */

// ── Activity Log ─────────────────────────────────────────────────────────────
export type {
  ActivityEntry,
  ActivityKind,
  ActivitySource,
} from './activity-schema'
// ── Audit Gate ──────────────────────────────────────────────────────────────
export {
  type AuditGate,
  AuditGateSchema,
  type AuditGateState,
  AuditGateStateSchema,
  type AuditGateTrigger,
  AuditGateTriggerSchema,
} from './audit-gate-schema'
// ── Audit ────────────────────────────────────────────────────────────────────
export {
  type AuditCategory,
  AuditCategorySchema,
  type AuditFinding,
  AuditFindingSchema,
  type AuditResponse,
  AuditResponseSchema,
  type AuditSeverity,
  AuditSeveritySchema,
} from './audit-schema'
// ── Batch Orchestration ──────────────────────────────────────────────────────
export { type OverflowDecision, OverflowDecisionSchema } from './batch-schema'
// ── Claude Iteration ─────────────────────────────────────────────────────────
export {
  type IterationOutcome,
  IterationOutcomeSchema,
  type IterationResult,
  IterationResultSchema,
} from './claude-schema'
// ── Configuration ────────────────────────────────────────────────────────────
export { type Config, ConfigSchema } from './config-schema'

// ── Display ──────────────────────────────────────────────────────────────────
export { type DisplayContext, DisplayContextSchema } from './display-schema'
// ── Claude Stream Events ─────────────────────────────────────────────────────
export { type ClaudeEvent, ClaudeEventSchema } from './events-schema'
// ── Subprocess Execution ─────────────────────────────────────────────────────
export { type ExecResult, ExecResultSchema } from './exec-schema'
// ── Issue Model ──────────────────────────────────────────────────────────────
export {
  type Issue,
  IssueSchema,
  type IssueState,
  IssueStateSchema,
  VALID_TRANSITIONS,
} from './issue-schema'
// ── Locking ──────────────────────────────────────────────────────────────────
export {
  type LockInfo,
  LockInfoSchema,
  type LockMode,
  LockModeSchema,
} from './lock-schema'
// ── Modes ────────────────────────────────────────────────────────────────────
export {
  type AutoSelectMode,
  AutoSelectModeSchema,
  type BarfMode,
  BarfModeSchema,
  type LoopMode,
  LoopModeSchema,
  type PromptMode,
  PromptModeSchema,
} from './mode-schema'
// ── Pre-Completion ───────────────────────────────────────────────────────────
export {
  type FixStep,
  FixStepSchema,
  type PreCompleteResult,
  PreCompleteResultSchema,
} from './pre-complete-schema'

// ── Session Index ────────────────────────────────────────────────────────
export {
  type AuditGateEvent,
  AuditGateEventSchema,
  type AutoEndEvent,
  AutoEndEventSchema,
  type AutoStartEvent,
  AutoStartEventSchema,
  type Session,
  type SessionEndEvent,
  SessionEndEventSchema,
  type SessionIndexEvent,
  SessionIndexEventSchema,
  type SessionStartEvent,
  SessionStartEventSchema,
  type SessionStatus,
} from './session-index-schema'
// ── Session Stats ────────────────────────────────────────────────────────────
export {
  formatSessionStatsBlock,
  formatStageLogEntry,
  type SessionStats,
  SessionStatsSchema,
  type StageLogEntry,
  StageLogEntrySchema,
  type StageLogInput,
} from './session-stats-schema'
// ── Verification ─────────────────────────────────────────────────────────────
export {
  type VerifyCheck,
  VerifyCheckSchema,
  type VerifyFailure,
  VerifyFailureSchema,
  type VerifyResult,
  VerifyResultSchema,
} from './verification-schema'
