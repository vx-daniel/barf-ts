/**
 * Types barrel — re-exports all schemas, types, and error classes.
 *
 * This file exists so that consumers can import from `@/types` without
 * knowing the internal schema directory structure. All Zod schemas live
 * in `@/types/schema/` and error classes live in `@/errors/`.
 *
 * @module Configuration
 */

// ── Error Classes ────────────────────────────────────────────────────────────
export { InvalidTransitionError, ProviderError } from '@/errors'
// ── Schemas (all Zod schemas and inferred types) ─────────────────────────────
export {
  type AuditCategory,
  // Audit
  AuditCategorySchema,
  type AuditFinding,
  AuditFindingSchema,
  type AuditGate,
  type AuditGateEvent,
  AuditGateEventSchema,
  AuditGateSchema,
  type AuditGateState,
  // Audit Gate
  AuditGateStateSchema,
  type AuditGateTrigger,
  AuditGateTriggerSchema,
  type AuditResponse,
  AuditResponseSchema,
  type AuditSeverity,
  AuditSeveritySchema,
  type AutoEndEvent,
  AutoEndEventSchema,
  type AutoSelectMode,
  AutoSelectModeSchema,
  type AutoStartEvent,
  AutoStartEventSchema,
  type BarfMode,
  // Modes
  BarfModeSchema,
  type ClaudeEvent,
  // Claude Stream Events
  ClaudeEventSchema,
  type Config,
  // Configuration
  ConfigSchema,
  type DisplayContext,
  // Display
  DisplayContextSchema,
  type ExecResult,
  // Subprocess Execution
  ExecResultSchema,
  type FixStep,
  // Pre-Completion
  FixStepSchema,
  formatSessionStatsBlock,
  formatStageLogEntry,
  type Issue,
  IssueSchema,
  type IssueState,
  // Issue Model
  IssueStateSchema,
  type IterationOutcome,
  // Claude Iteration
  IterationOutcomeSchema,
  type IterationResult,
  IterationResultSchema,
  type LockInfo,
  LockInfoSchema,
  type LockMode,
  // Locking
  LockModeSchema,
  type LoopMode,
  LoopModeSchema,
  type OverflowDecision,
  // Batch Orchestration
  OverflowDecisionSchema,
  type PreCompleteResult,
  PreCompleteResultSchema,
  type PromptMode,
  PromptModeSchema,
  type Session,
  type SessionEndEvent,
  SessionEndEventSchema,
  type SessionIndexEvent,
  SessionIndexEventSchema,
  type SessionStartEvent,
  // Session Index
  SessionStartEventSchema,
  type SessionStats,
  // Session Stats
  SessionStatsSchema,
  type SessionStatus,
  type StageLogEntry,
  // Stage Log
  StageLogEntrySchema,
  type StageLogInput,
  VALID_TRANSITIONS,
  type VerifyCheck,
  // Verification
  VerifyCheckSchema,
  type VerifyFailure,
  VerifyFailureSchema,
  type VerifyResult,
  VerifyResultSchema,
} from '@/types/schema'
