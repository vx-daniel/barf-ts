import { z } from 'zod'

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
