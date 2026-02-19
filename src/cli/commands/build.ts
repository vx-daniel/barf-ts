import type { IssueProvider } from '@/core/issue-providers/base.js'
import type { Config } from '@/types/index'
import { runLoop } from '@/core/batch'
import { createLogger } from '@/utils/logger'

const logger = createLogger('build')

/**
 * Builds one or more issues (PLANNED/IN_PROGRESS → COMPLETED) using Claude AI.
 *
 * **Single-issue mode (`opts.issue` set):** Builds the named issue and returns.
 *
 * **Batch mode (`opts.issue` omitted):** Lists all issues, filters to `BUILDABLE`
 * states, picks up to `opts.batch`, and runs them concurrently via
 * `Promise.allSettled`. Exits with code 1 if any build fails.
 *
 * @param provider - Issue provider supplying and persisting issues.
 * @param opts - `issue`: explicit issue ID; `batch`: concurrency limit; `max`: iteration cap (0 = use `config`).
 * @param config - Loaded barf configuration.
 */
export async function buildCommand(
  provider: IssueProvider,
  opts: { issue?: string; batch: number; max: number },
  config: Config
): Promise<void> {
  // --max overrides config.maxIterations for this invocation only
  const effectiveConfig = opts.max > 0 ? { ...config, maxIterations: opts.max } : config

  if (opts.issue) {
    logger.info({ issueId: opts.issue }, 'Building issue')
    const result = await runLoop(opts.issue, 'build', effectiveConfig, provider)
    if (result.isErr()) {
      logger.error({ err: result.error }, result.error.message)
      process.exit(1)
    }
    logger.info({ issueId: opts.issue }, 'Issue build complete')
    return
  }

  // Batch mode: pick up to opts.batch issues in priority order
  const listResult = await provider.listIssues()
  if (listResult.isErr()) {
    logger.error({ err: listResult.error }, listResult.error.message)
    process.exit(1)
  }

  /** Issue states eligible for the build loop. */
  const BUILDABLE = new Set<string>(['IN_PROGRESS', 'PLANNED', 'NEW'])
  const candidates = listResult.value.filter(i => BUILDABLE.has(i.state)).slice(0, opts.batch)

  if (candidates.length === 0) {
    logger.info('No issues available for building.')
    return
  }

  logger.info({ count: candidates.length }, 'Building issues concurrently')

  const results = await Promise.allSettled(
    candidates.map(issue => runLoop(issue.id, 'build', effectiveConfig, provider))
  )

  let failures = 0
  for (const [i, r] of results.entries()) {
    const id = candidates[i]!.id
    if (r.status === 'rejected') {
      logger.error({ issueId: id, reason: r.reason }, 'Build rejected')
      failures++
    } else if (r.value.isErr()) {
      logger.error({ issueId: id, err: r.value.error }, r.value.error.message)
      failures++
    } else {
      logger.info({ issueId: id }, 'Build complete')
    }
  }

  if (failures > 0) {
    process.exit(1)
  }
}
