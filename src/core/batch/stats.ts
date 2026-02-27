/**
 * Session stats persistence — tracks and writes token usage per run.
 *
 * After each orchestration loop run, barf persists session statistics
 * (token counts, duration, iterations) to the issue frontmatter.
 * The human-readable stage log is now appended by {@link IssueProvider.transition}
 * when a `stageLog` argument is passed.
 *
 * Stats persistence is best-effort: failures are logged but never propagate,
 * because losing stats should not crash a successful build.
 *
 * @module Orchestration
 */
import type { SessionStats } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

const logger = createLogger('batch')

/**
 * Creates a {@link SessionStats} snapshot from the current loop state.
 *
 * Captures the elapsed time, cumulative token counts, iteration count,
 * and model used. Called at the end of each orchestration run (both
 * normal completion and early exit via split).
 *
 * @param sessionStartTime - Unix timestamp (ms) when the session started.
 * @param totalInputTokens - Cumulative input tokens across all iterations.
 * @param totalOutputTokens - Cumulative output tokens across all iterations.
 * @param lastContextSize - Token count from the most recent iteration.
 * @param iteration - Number of iterations completed.
 * @param model - Model identifier used for this session.
 * @returns A fully-populated {@link SessionStats} object.
 * @category Orchestration
 */
export function createSessionStats(
  sessionStartTime: number,
  totalInputTokens: number,
  totalOutputTokens: number,
  lastContextSize: number,
  iteration: number,
  model: string,
): SessionStats {
  return {
    startedAt: new Date(sessionStartTime).toISOString(),
    durationSeconds: Math.floor((Date.now() - sessionStartTime) / 1000),
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    finalContextSize: lastContextSize,
    iterations: iteration,
    model,
  }
}

/**
 * Persists session stats to the issue frontmatter (cumulative totals only).
 *
 * This function is best-effort — failures are logged but never propagate.
 * Stats are important for observability but should not crash a successful build.
 *
 * The human-readable stage log is now written by {@link IssueProvider.transition}
 * when a `stageLog` argument is provided — this function only updates the
 * frontmatter accumulation fields.
 *
 * The frontmatter fields updated are:
 * - `total_input_tokens` — cumulative input tokens across all runs
 * - `total_output_tokens` — cumulative output tokens across all runs
 * - `total_duration_seconds` — cumulative wall-clock time
 * - `total_iterations` — cumulative iteration count
 * - `run_count` — incremented by 1
 *
 * @param issueId - ID of the issue to update.
 * @param stats - Session statistics to persist.
 * @param provider - Issue provider for reading and writing the issue.
 * @category Orchestration
 */
export async function persistSessionStats(
  issueId: string,
  stats: SessionStats,
  provider: IssueProvider,
): Promise<void> {
  try {
    const current = await provider.fetchIssue(issueId)
    if (current.isErr()) {
      logger.warn(
        { issueId, err: current.error.message },
        'could not fetch issue for stats',
      )
      return
    }
    const issue = current.value
    await provider.writeIssue(issueId, {
      total_input_tokens: issue.total_input_tokens + stats.inputTokens,
      total_output_tokens: issue.total_output_tokens + stats.outputTokens,
      total_duration_seconds:
        issue.total_duration_seconds + stats.durationSeconds,
      total_iterations: issue.total_iterations + stats.iterations,
      run_count: issue.run_count + 1,
    })
    logger.info(
      {
        issueId,
        durationSeconds: stats.durationSeconds,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
      },
      'session stats persisted',
    )
  } catch (e) {
    logger.warn(
      { issueId, err: toError(e).message },
      'failed to persist session stats',
    )
  }
}
