import { z } from 'zod'

// ── Issue ─────────────────────────────────────────────────────────────────────

/**
 * All valid states an issue can occupy.
 *
 * ```
 * NEW → PLANNED → IN_PROGRESS → COMPLETED
 *          ↘           ↘
 *           STUCK ←→ SPLIT
 * ```
 *
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
 * Runtime mode that acquired the lock.
 *
 * @category Locking
 * @group Locking
 */
export const LockModeSchema = z.enum(['plan', 'build', 'split'])
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
  planModel: z.string().default('claude-opus-4-6'),
  buildModel: z.string().default('claude-sonnet-4-6'),
  splitModel: z.string().default('claude-sonnet-4-6'),
  extendedContextModel: z.string().default('claude-opus-4-6'),
  pushStrategy: z.enum(['iteration', 'on_complete', 'manual']).default('iteration'),
  issueProvider: z.enum(['local', 'github']).default('local'),
  githubRepo: z.string().default(''),
  streamLogDir: z.string().default(''),
  barfDir: z.string().default('.barf')
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
 * A structured event emitted by the Claude stream parser.
 *
 * - `usage`: cumulative token count from the main conversation context
 * - `tool`: a tool invocation name from an assistant message
 *
 * Emitted by `parseClaudeStream` in `core/context`.
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
