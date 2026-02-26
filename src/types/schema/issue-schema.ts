/**
 * Issue model schemas — the core data structure of barf.
 *
 * An issue represents a unit of work tracked by barf. Issues move through a
 * state machine ({@link IssueStateSchema}) from `NEW` to `VERIFIED`, with
 * side-states `STUCK` and `SPLIT` for exceptional flows.
 *
 * All issue data is stored as frontmatter markdown files under `issuesDir`.
 * The `body` field holds everything after the closing `---` delimiter.
 *
 * @module issue-schema
 */
import { z } from 'zod'

/**
 * All valid states an issue can occupy.
 *
 * The state machine enforces this progression:
 * ```
 * NEW → PLANNED → IN_PROGRESS → COMPLETED → VERIFIED
 *                     ↘                         ↑
 *                      STUCK ←→ SPLIT    (via fix sub-issues)
 * ```
 *
 * - `NEW` — freshly created, may need triage (`needs_interview=true`)
 * - `PLANNED` — a plan file exists; ready for build
 * - `IN_PROGRESS` — Claude is actively working on this issue
 * - `COMPLETED` — Claude finished; pending automated verification
 * - `VERIFIED` — verification passed; true terminal state
 * - `STUCK` — Claude hit a blocker it cannot resolve alone
 * - `SPLIT` — issue was too large and was broken into children
 *
 * Transitions are enforced by `validateTransition` in `core/issue/index.ts` —
 * never mutate `issue.state` directly.
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
  'COMPLETED',
  'VERIFIED',
])

/**
 * A barf issue state string literal union.
 * Derived from {@link IssueStateSchema}.
 *
 * @category Issue Model
 * @group Issue
 */
export type IssueState = z.infer<typeof IssueStateSchema>

/**
 * A barf work item — the central data model of the system.
 *
 * Stored as frontmatter markdown under `issuesDir`. The frontmatter fields
 * map directly to this schema's properties. The `body` field contains
 * everything after the closing `---` delimiter (the issue description,
 * acceptance criteria, session stats blocks, etc.).
 *
 * Key fields for orchestration:
 * - `state` — current position in the {@link IssueStateSchema} state machine
 * - `split_count` — how many times this issue has been split (controls overflow decisions)
 * - `children` — IDs of sub-issues created by split operations
 * - `needs_interview` — triage flag; when `true`, issue is parked for `/barf-interview`
 *
 * Key fields for observability:
 * - `total_input_tokens`, `total_output_tokens` — cumulative token usage across all runs
 * - `total_duration_seconds` — cumulative wall-clock time
 * - `run_count` — number of sessions executed on this issue
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
  /** Number of times verification has been attempted on this issue. Incremented on each failure. */
  verify_count: z.number().int().nonnegative().default(0),
  /** When `true`, this issue was created by `verifyIssue` to fix a parent's failures — skip re-verifying it. */
  is_verify_fix: z.boolean().optional(),
  /** When `true`, `verify_count` exceeded `maxVerifyRetries`; issue is left as COMPLETED without VERIFIED. */
  verify_exhausted: z.boolean().optional(),
  /** Cumulative input tokens (base + cache) across all runs. */
  total_input_tokens: z.number().nonnegative().default(0),
  /** Cumulative output tokens across all runs. */
  total_output_tokens: z.number().nonnegative().default(0),
  /** Cumulative wall-clock duration in seconds across all runs. */
  total_duration_seconds: z.number().nonnegative().default(0),
  /** Total iterations across all runs. */
  total_iterations: z.number().int().nonnegative().default(0),
  /** Number of runs/sessions executed on this issue. */
  run_count: z.number().int().nonnegative().default(0),
  body: z.string(),
})

/**
 * A validated barf work item. Derived from {@link IssueSchema}.
 *
 * @category Issue Model
 * @group Issue
 */
export type Issue = z.infer<typeof IssueSchema>
