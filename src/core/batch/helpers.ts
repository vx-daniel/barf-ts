/**
 * Batch orchestration helpers — pure utility functions used by the main loop.
 *
 * These are stateless, side-effect-free functions that support the orchestration
 * loop without managing any I/O or state transitions themselves.
 *
 * @module Orchestration
 */
import { existsSync } from 'fs'
import { join } from 'path'
import type { IssueProvider } from '@/core/issue/base'
import type { Config } from '@/types'
import type { OverflowDecision } from '@/types/schema/batch-schema'
import { createLogger } from '@/utils/logger'

const logger = createLogger('batch')

/**
 * Pure decision: should the loop run another iteration?
 *
 * Returns `true` when `maxIterations` is 0 (unlimited) or when the current
 * iteration count hasn't reached the limit yet. This centralizes the
 * continuation logic so the main loop doesn't embed magic comparisons.
 *
 * @param iteration - Zero-based current iteration count.
 * @param config - Barf configuration containing `maxIterations`.
 * @returns `true` if the loop should continue, `false` to stop.
 * @category Orchestration
 */
export function shouldContinue(iteration: number, config: Config): boolean {
  return config.maxIterations === 0 || iteration < config.maxIterations
}

/**
 * Pure decision: given the current split count, decide whether to split or escalate.
 *
 * When a Claude session hits the context window limit (overflow), barf must decide:
 * - **Split** (`split_count < maxAutoSplits`): break the issue into smaller sub-issues
 * - **Escalate** (`split_count >= maxAutoSplits`): switch to a larger context model
 *
 * @param splitCount - How many times this issue has already been split.
 * @param config - Barf configuration containing `maxAutoSplits`, `splitModel`, `extendedContextModel`.
 * @returns An {@link OverflowDecision} with the chosen action and next model to use.
 * @category Orchestration
 */
export function handleOverflow(
  splitCount: number,
  config: Config,
): OverflowDecision {
  if (splitCount < config.maxAutoSplits) {
    return { action: 'split', nextModel: config.splitModel }
  }
  return { action: 'escalate', nextModel: config.extendedContextModel }
}

/**
 * Resolves the local file path for an issue, used for prompt template injection.
 *
 * For the local filesystem provider, issues are stored as `{issuesDir}/{id}.md`.
 * For the GitHub provider, there is no local file — the issue ID is returned
 * as a fallback so the prompt template receives a meaningful identifier.
 *
 * @param issueId - Issue identifier to resolve.
 * @param config - Barf configuration containing `issuesDir`.
 * @returns Absolute path to the issue markdown file, or the issue ID if no file exists.
 * @category Orchestration
 */
export function resolveIssueFile(issueId: string, config: Config): string {
  const md = join(config.issuesDir, `${issueId}.md`)
  if (existsSync(md)) {
    return md
  }
  return issueId // GitHub fallback — prompt receives issue ID only
}

/**
 * Plans each NEW child issue sequentially after a split operation.
 *
 * After a split, the parent issue's children need to be planned before they
 * can be built. This function iterates through child IDs, fetches each one,
 * and runs the plan loop for any that are still in `NEW` state.
 *
 * Failures are logged but do not propagate — a single child planning failure
 * should not prevent the remaining children from being planned.
 *
 * No global state mutations — all state passed as arguments.
 *
 * @param childIds - IDs of child issues to plan.
 * @param config - Barf configuration.
 * @param provider - Issue provider for fetching and writing issues.
 * @param runLoop - The runLoop function (passed to avoid circular imports).
 * @param deps - Injectable dependencies forwarded to runLoop.
 * @category Orchestration
 */
export async function planSplitChildren(
  childIds: string[],
  config: Config,
  provider: IssueProvider,
  // biome-ignore lint/suspicious/noExplicitAny: circular type — runLoop references planSplitChildren
  runLoop: (...args: any[]) => any,
  deps: Record<string, unknown>,
): Promise<void> {
  for (const childId of childIds) {
    const result = await provider.fetchIssue(childId)
    if (result.isErr()) {
      logger.warn({ childId }, 'could not fetch child issue for auto-planning')
      continue
    }
    if (result.value.state !== 'NEW') {
      logger.debug(
        { childId, state: result.value.state },
        'skipping non-NEW child',
      )
      continue
    }
    logger.info({ childId }, 'auto-planning split child')
    const planResult = await runLoop(childId, 'plan', config, provider, deps)
    if (planResult.isErr()) {
      logger.warn(
        { childId, error: planResult.error?.message },
        'child plan failed',
      )
    }
  }
}
