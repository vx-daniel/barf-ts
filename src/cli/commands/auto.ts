import type { Config, IssueState } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { runLoop } from '@/core/batch'
import { createLogger } from '@/utils/logger'

const logger = createLogger('auto')

/** Issue states queued for planning on each {@link autoCommand} loop iteration. */
const PLAN_STATES = new Set<IssueState>(['NEW'])
/** Issue states queued for building on each {@link autoCommand} loop iteration. */
const BUILD_STATES = new Set<IssueState>(['PLANNED', 'IN_PROGRESS'])

/**
 * Continuously orchestrates plan → build until no actionable issues remain.
 *
 * Each iteration:
 * 1. Plans all `PLAN_STATES` issues sequentially (order preserved).
 * 2. Builds up to `opts.batch` `BUILD_STATES` issues concurrently.
 *
 * The loop exits when both queues are empty or the provider returns an error.
 * `opts.max` is unused — iteration count defaults to `config.maxIterations`.
 *
 * @param provider - Issue provider supplying and persisting issues.
 * @param opts - `batch`: max concurrent builds; `max`: reserved, currently unused.
 * @param config - Loaded barf configuration.
 */
export async function autoCommand(
  provider: IssueProvider,
  opts: { batch: number; max: number },
  config: Config
): Promise<void> {
  while (true) {
    const listResult = await provider.listIssues()
    if (listResult.isErr()) {
      break
    }

    const issues = listResult.value
    const toPlan = issues.filter(i => PLAN_STATES.has(i.state))
    const toBuild = issues.filter(i => BUILD_STATES.has(i.state)).slice(0, opts.batch)

    if (toPlan.length === 0 && toBuild.length === 0) {
      break
    }

    for (const issue of toPlan) {
      const result = await runLoop(issue.id, 'plan', config, provider)
      if (result.isErr()) {
        logger.warn({ issueId: issue.id, err: result.error.message }, 'plan loop failed')
      }
    }

    if (toBuild.length > 0) {
      const results = await Promise.allSettled(
        toBuild.map(i => runLoop(i.id, 'build', config, provider))
      )
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.isErr()) {
          logger.warn({ err: r.value.error.message }, 'build loop failed')
        }
      }
    }
  }
}
