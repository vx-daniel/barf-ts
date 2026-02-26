/**
 * Types barrel — re-exports all schemas, types, and error classes.
 *
 * This file exists so that consumers can import from `@/types` without
 * knowing the internal schema directory structure. All Zod schemas live
 * in `@/types/schema/` and error classes live in `@/errors/`.
 *
 * @module types
 */

// ── Schemas (all Zod schemas and inferred types) ─────────────────────────────
export {
  // Issue Model
  IssueStateSchema,
  type IssueState,
  IssueSchema,
  type Issue,
  // Configuration
  ConfigSchema,
  type Config,
  // Locking
  LockModeSchema,
  type LockMode,
  LockInfoSchema,
  type LockInfo,
  // Modes
  BarfModeSchema,
  type BarfMode,
  LoopModeSchema,
  type LoopMode,
  PromptModeSchema,
  type PromptMode,
  AutoSelectModeSchema,
  type AutoSelectMode,
  // Claude Stream Events
  ClaudeEventSchema,
  type ClaudeEvent,
  // Display
  DisplayContextSchema,
  type DisplayContext,
  // Claude Iteration
  IterationOutcomeSchema,
  type IterationOutcome,
  IterationResultSchema,
  type IterationResult,
  // Batch Orchestration
  OverflowDecisionSchema,
  type OverflowDecision,
  // Subprocess Execution
  ExecResultSchema,
  type ExecResult,
  // Audit
  AuditCategorySchema,
  type AuditCategory,
  AuditSeveritySchema,
  type AuditSeverity,
  AuditFindingSchema,
  type AuditFinding,
  AuditResponseSchema,
  type AuditResponse,
  // Session Stats
  SessionStatsSchema,
  type SessionStats,
  formatSessionStatsBlock,
  // Verification
  VerifyCheckSchema,
  type VerifyCheck,
  VerifyFailureSchema,
  type VerifyFailure,
  VerifyResultSchema,
  type VerifyResult,
  // Pre-Completion
  FixStepSchema,
  type FixStep,
  PreCompleteResultSchema,
  type PreCompleteResult,
} from '@/types/schema'

// ── Error Classes ────────────────────────────────────────────────────────────
export { InvalidTransitionError, ProviderError } from '@/errors'
