/** @module Configuration */
import { z } from 'zod'
import { IssueStateSchema } from '@/types/schema/issue-schema'

/**
 * Statistics for a single Claude session/run on an issue.
 * Tracked across all iterations within one `runLoop` invocation.
 *
 * @category Stats
 */
export const SessionStatsSchema = z.object({
  /** ISO 8601 timestamp when the session started. */
  startedAt: z.string().datetime(),
  /** Wall-clock duration in seconds. */
  durationSeconds: z.number().nonnegative(),
  /** Cumulative input tokens (base + cache_creation + cache_read) across all iterations. */
  inputTokens: z.number().nonnegative(),
  /** Cumulative output tokens across all iterations. */
  outputTokens: z.number().nonnegative(),
  /** Final context size (input tokens) at end of last iteration. */
  finalContextSize: z.number().nonnegative(),
  /** Number of iterations executed. */
  iterations: z.number().int().nonnegative(),
  /** Model used for this session (last model if escalated). */
  model: z.string(),
})

/** A validated session stats object. Derived from {@link SessionStatsSchema}. */
export type SessionStats = z.infer<typeof SessionStatsSchema>

/**
 * Formats a {@link SessionStats} object as a markdown block for appending to an issue body.
 *
 * @param stats - Session stats to format
 * @returns Markdown string with a horizontal rule and stats details
 * @deprecated Use {@link formatStageLogEntry} instead — stage log entries replace run stats blocks.
 */
export function formatSessionStatsBlock(stats: SessionStats): string {
  const date = new Date(stats.startedAt)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, 'Z')
  return [
    '---',
    '',
    `### Run Stats — ${date}`,
    '',
    `- **Duration:** ${stats.durationSeconds}s`,
    `- **Input tokens:** ${stats.inputTokens.toLocaleString()} (final context: ${stats.finalContextSize.toLocaleString()})`,
    `- **Output tokens:** ${stats.outputTokens.toLocaleString()}`,
    `- **Iterations:** ${stats.iterations}`,
    `- **Model:** ${stats.model}`,
  ].join('\n')
}

/**
 * A single entry in the per-issue stage log, capturing metrics from one state transition.
 *
 * Appended to the issue body's `## Stage Log` section each time
 * {@link IssueProvider.transition} is called with stage log metadata.
 *
 * @category Stats
 */
export const StageLogEntrySchema = z.object({
  /** State the issue was in before this transition. */
  fromState: IssueStateSchema,
  /** State the issue transitioned to. */
  toState: IssueStateSchema,
  /** ISO 8601 timestamp of the transition. */
  timestamp: z.string().datetime(),
  /** Wall-clock seconds spent in {@link fromState}. */
  durationInStageSeconds: z.number().nonnegative(),
  /** Input tokens consumed while in {@link fromState}. */
  inputTokens: z.number().nonnegative(),
  /** Output tokens consumed while in {@link fromState}. */
  outputTokens: z.number().nonnegative(),
  /** Context window size (input tokens) at end of last iteration. */
  finalContextSize: z.number().nonnegative(),
  /** Number of iterations executed while in {@link fromState}. */
  iterations: z.number().int().nonnegative(),
  /** Percentage of context window used (1–100), if known. */
  contextUsagePercent: z.number().int().min(0).max(100).optional(),
  /** Model used during this stage. */
  model: z.string(),
  /** What triggered the transition (e.g. `"auto/plan"`, `"auto/build"`, `"manual/dashboard"`). */
  trigger: z.string(),
})

/** A validated stage log entry. Derived from {@link StageLogEntrySchema}. */
export type StageLogEntry = z.infer<typeof StageLogEntrySchema>

/**
 * The subset of {@link StageLogEntry} that callers pass to `transition()`.
 * The `fromState`, `toState`, and `timestamp` fields are filled in automatically.
 */
export type StageLogInput = Omit<
  StageLogEntry,
  'fromState' | 'toState' | 'timestamp'
>

/**
 * Formats a {@link StageLogEntry} as a markdown heading block for the `## Stage Log` section.
 *
 * @param entry - Stage log entry to format
 * @returns Markdown string with heading and bullet-point stats
 */
export function formatStageLogEntry(entry: StageLogEntry): string {
  const date = new Date(entry.timestamp)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, 'Z')
  const lines = [
    `### ${entry.toState} — ${date}`,
    '',
    `- **From:** ${entry.fromState}`,
    `- **Duration in stage:** ${entry.durationInStageSeconds}s`,
    `- **Input tokens:** ${entry.inputTokens.toLocaleString()} (final context: ${entry.finalContextSize.toLocaleString()})`,
    `- **Output tokens:** ${entry.outputTokens.toLocaleString()}`,
    `- **Iterations:** ${entry.iterations}`,
  ]
  if (entry.contextUsagePercent !== undefined) {
    lines.push(`- **Context used:** ${entry.contextUsagePercent}%`)
  }
  lines.push(`- **Model:** ${entry.model}`)
  lines.push(`- **Trigger:** ${entry.trigger}`)
  return lines.join('\n')
}
