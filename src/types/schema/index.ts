/**
 * Schema barrel — re-exports all Zod schemas and their inferred types.
 *
 * This is the single entry point for importing schema types throughout the
 * codebase. All Zod schemas live in this directory (`src/types/schema/`)
 * and are re-exported here for convenience.
 *
 * @module Configuration
 */

// ── Issue Model ──────────────────────────────────────────────────────────────
export {
  IssueStateSchema,
  type IssueState,
  VALID_TRANSITIONS,
  IssueSchema,
  type Issue,
} from './issue-schema'

// ── Activity Log ─────────────────────────────────────────────────────────────
export type {
  ActivityKind,
  ActivitySource,
  ActivityEntry,
} from './activity-schema'

// ── Configuration ────────────────────────────────────────────────────────────
export { ConfigSchema, type Config } from './config-schema'

// ── Locking ──────────────────────────────────────────────────────────────────
export {
  LockModeSchema,
  type LockMode,
  LockInfoSchema,
  type LockInfo,
} from './lock-schema'

// ── Modes ────────────────────────────────────────────────────────────────────
export {
  BarfModeSchema,
  type BarfMode,
  LoopModeSchema,
  type LoopMode,
  PromptModeSchema,
  type PromptMode,
  AutoSelectModeSchema,
  type AutoSelectMode,
} from './mode-schema'

// ── Claude Stream Events ─────────────────────────────────────────────────────
export { ClaudeEventSchema, type ClaudeEvent } from './events-schema'

// ── Display ──────────────────────────────────────────────────────────────────
export { DisplayContextSchema, type DisplayContext } from './display-schema'

// ── Claude Iteration ─────────────────────────────────────────────────────────
export {
  IterationOutcomeSchema,
  type IterationOutcome,
  IterationResultSchema,
  type IterationResult,
} from './claude-schema'

// ── Batch Orchestration ──────────────────────────────────────────────────────
export { OverflowDecisionSchema, type OverflowDecision } from './batch-schema'

// ── Subprocess Execution ─────────────────────────────────────────────────────
export { ExecResultSchema, type ExecResult } from './exec-schema'

// ── Audit ────────────────────────────────────────────────────────────────────
export {
  AuditCategorySchema,
  type AuditCategory,
  AuditSeveritySchema,
  type AuditSeverity,
  AuditFindingSchema,
  type AuditFinding,
  AuditResponseSchema,
  type AuditResponse,
} from './audit-schema'

// ── Session Stats ────────────────────────────────────────────────────────────
export {
  SessionStatsSchema,
  type SessionStats,
  formatSessionStatsBlock,
} from './session-stats-schema'

// ── Verification ─────────────────────────────────────────────────────────────
export {
  VerifyCheckSchema,
  type VerifyCheck,
  VerifyFailureSchema,
  type VerifyFailure,
  VerifyResultSchema,
  type VerifyResult,
} from './verification-schema'

// ── Pre-Completion ───────────────────────────────────────────────────────────
export {
  FixStepSchema,
  type FixStep,
  PreCompleteResultSchema,
  type PreCompleteResult,
} from './pre-complete-schema'
