import { z } from 'zod'
import { LoopModeSchema } from '@/types/schema/mode-schema'

// ── Issue ─────────────────────────────────────────────────────────────────────

/**
 * All valid states an issue can occupy.
 *
 * ```
 * NEW → PLANNED → IN_PROGRESS → COMPLETED
 *                     ↘
 *                      STUCK ←→ SPLIT
 * ```
 *
 * NEW issues with `needs_interview=true` are parked until `/barf-interview` refines them.
 * Transitions are enforced by `validateTransition` — never mutate state directly.
 *
 * @category Issue Model
 * @group Issue
 */
export const IssueStateSchema = z.enum([
  'NEW',
  'PLANNED',
  'IN_PROGRESS',
  'STUCK',
  'SPLIT',
  'COMPLETED'
])
/**
 * A barf issue state. Derived from {@link IssueStateSchema}.
 *
 * @category Issue Model
 * @group Issue
 */
export type IssueState = z.infer<typeof IssueStateSchema>

/**
 * A barf work item. Stored as frontmatter markdown under `issuesDir`.
 *
 * The `body` field contains everything after the closing `---` delimiter.
 * `children` holds IDs of sub-issues created by a split operation.
 * `split_count` tracks how many times this issue has been split (used for overflow decisions).
 *
 * @category Issue Model
 * @group Issue
 */
export const IssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  state: IssueStateSchema,
  parent: z.string(),
  children: z.array(z.string()),
  split_count: z.number().int().nonnegative(),
  force_split: z.boolean().default(false),
  context_usage_percent: z.number().int().min(1).max(100).optional(),
  /**
   * Triage result set by `triageIssue`.
   * - `undefined` — not yet triaged
   * - `false` — triaged, no refinement needed (or interview complete)
   * - `true` — triaged, needs `/barf-interview` before planning
   */
  needs_interview: z.boolean().optional(),
  body: z.string()
})
/**
 * A validated barf work item. Derived from {@link IssueSchema}.
 *
 * @category Issue Model
 * @group Issue
 */
export type Issue = z.infer<typeof IssueSchema>

// ── Lock ──────────────────────────────────────────────────────────────────────

/**
 * Runtime mode that acquired the lock. Alias for {@link LoopModeSchema}.
 *
 * @category Locking
 * @group Locking
 */
export const LockModeSchema = LoopModeSchema
/**
 * A barf lock mode. Derived from {@link LockModeSchema}.
 *
 * @category Locking
 * @group Locking
 */
export type LockMode = z.infer<typeof LockModeSchema>

/**
 * Contents of a `.barf/<id>.lock` file. Written atomically at lock acquisition.
 * Used for stale-lock detection (dead PID) and status display.
 *
 * @category Locking
 * @group Locking
 */
export const LockInfoSchema = z.object({
  pid: z.number().int().positive(),
  acquiredAt: z.string().datetime(),
  state: IssueStateSchema,
  mode: LockModeSchema
})
/**
 * Parsed lock file contents. Derived from {@link LockInfoSchema}.
 *
 * @category Locking
 * @group Locking
 */
export type LockInfo = z.infer<typeof LockInfoSchema>

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Runtime configuration for a barf project.
 *
 * Loaded from `.barfrc` (KEY=VALUE format) via `loadConfig`. Falls back to
 * these defaults when the file is absent or a key is missing.
 *
 * @category Configuration
 * @group Configuration
 */
export const ConfigSchema = z.object({
  issuesDir: z.string().default('issues'),
  planDir: z.string().default('plans'),
  contextUsagePercent: z.number().int().default(75),
  maxAutoSplits: z.number().int().default(3),
  maxIterations: z.number().int().default(0),
  claudeTimeout: z.number().int().default(3600),
  testCommand: z.string().default(''),
  triageModel: z.string().default('claude-haiku-4-5-20251001'),
  auditModel: z.string().default('gpt-4o'),
  openaiApiKey: z.string().default(''),
  auditProvider: z.enum(['openai', 'gemini', 'claude']).default('openai'),
  geminiApiKey: z.string().default(''),
  geminiModel: z.string().default('gemini-1.5-pro'),
  anthropicApiKey: z.string().default(''),
  claudeAuditModel: z.string().default('claude-sonnet-4-6'),
  planModel: z.string().default('claude-opus-4-6'),
  buildModel: z.string().default('claude-sonnet-4-6'),
  splitModel: z.string().default('claude-sonnet-4-6'),
  extendedContextModel: z.string().default('claude-opus-4-6'),
  pushStrategy: z.enum(['iteration', 'on_complete', 'manual']).default('iteration'),
  issueProvider: z.enum(['local', 'github']).default('local'),
  githubRepo: z.string().default(''),
  streamLogDir: z.string().default(''),
  barfDir: z.string().default('.barf'),
  promptDir: z.string().default(''),
  logFile: z.string().default('barf.log'),
  logLevel: z.string().default('info'),
  logPretty: z.boolean().default(false)
})
/**
 * Validated barf runtime configuration. Derived from {@link ConfigSchema}.
 *
 * @category Configuration
 * @group Configuration
 */
export type Config = z.infer<typeof ConfigSchema>

// ── Claude stream events ──────────────────────────────────────────────────────

/**
 * A structured event emitted during SDK iteration.
 *
 * - `usage`: cumulative token count from the main conversation context
 * - `tool`: a tool invocation name from an assistant message
 *
 * Emitted by `consumeSDKQuery` in `core/claude`.
 *
 * @category Claude Stream
 * @group Claude Events
 */
export const ClaudeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('usage'), tokens: z.number() }),
  z.object({ type: z.literal('tool'), name: z.string() })
])
/**
 * A parsed Claude stream event. Derived from {@link ClaudeEventSchema}.
 *
 * @category Claude Stream
 * @group Claude Events
 */
export type ClaudeEvent = z.infer<typeof ClaudeEventSchema>

// ── Display ───────────────────────────────────────────────────────────────────

/**
 * Contextual fields rendered in the 2-line sticky TTY header during a Claude iteration.
 * Passed to {@link runClaudeIteration} and {@link triageIssue} to identify what is running.
 *
 * @category Display
 */
export interface DisplayContext {
  /** Command or loop mode being executed (e.g. `'plan'`, `'build'`, `'triage'`). */
  mode: string
  /** Issue ID being processed. */
  issueId: string
  /** Current issue state at the time of the call. */
  state: string
  /** Issue title (truncated to 50 chars before display). */
  title: string
}

// ── Error types ───────────────────────────────────────────────────────────────

/**
 * Thrown by `validateTransition` when a state change is not permitted.
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
 * Wraps I/O errors from issue provider operations.
 *
 * @category Issue Providers
 * @group Issue
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
