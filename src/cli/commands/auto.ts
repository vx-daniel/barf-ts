import type { Config, IssueState } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { runLoop } from '@/core/batch'
import { interviewLoop } from '@/core/interview'
import { createLogger } from '@/utils/logger'

const logger = createLogger('auto')

/** Issue states queued for planning on each {@link autoCommand} loop iteration. */
const PLAN_STATES = new Set<IssueState>(['INTERVIEWING'])
/** Issue states queued for building on each {@link autoCommand} loop iteration. */
const BUILD_STATES = new Set<IssueState>(['PLANNED', 'IN_PROGRESS'])

/**
 * Continuously orchestrates interview → plan → build until no actionable issues remain.
 *
 * Each iteration:
 * 1. Interviews all `NEW` issues interactively (NEW → INTERVIEWING → PLANNED).
 * 2. Warns about any stuck `INTERVIEWING` issues (interrupted previous interviews).
 * 3. Plans all `PLAN_STATES` (INTERVIEWING) issues sequentially.
 * 4. Builds up to `opts.batch` `BUILD_STATES` issues concurrently.
 *
 * The loop exits when all queues are empty or the provider returns an error.
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
      logger.error({ err: listResult.error }, listResult.error.message)
      process.exitCode = 1
      return
    }

    const issues = listResult.value
    const toInterview = issues.filter(i => i.state === 'NEW')
    const stuckInterviewing = issues.filter(i => i.state === 'INTERVIEWING')
    const toPlan = issues.filter(i => PLAN_STATES.has(i.state))
    const toBuild = issues.filter(i => BUILD_STATES.has(i.state)).slice(0, opts.batch)

    const hasWork = toInterview.length > 0 || toPlan.length > 0 || toBuild.length > 0

    if (!hasWork) {
      logger.info('no actionable issues — done')
      break
    }

    // ── Interview phase (interactive — must run before plan/build) ─────────────
    for (const issue of toInterview) {
      logger.info({ issueId: issue.id }, 'interviewing new issue')

      const startTransition = await provider.transition(issue.id, 'INTERVIEWING')
      if (startTransition.isErr()) {
        logger.warn(
          { issueId: issue.id, err: startTransition.error.message },
          'interview start failed'
        )
        continue
      }

      const loopResult = await interviewLoop(issue.id, config, provider)
      if (loopResult.isErr()) {
        logger.warn({ issueId: issue.id, err: loopResult.error.message }, 'interview loop failed')
        continue
      }

      const endTransition = await provider.transition(issue.id, 'PLANNED')
      if (endTransition.isErr()) {
        logger.warn(
          { issueId: issue.id, err: endTransition.error.message },
          'interview completion failed'
        )
      }
    }

    // Warn about interrupted interviews (INTERVIEWING state from a previous session)
    for (const issue of stuckInterviewing) {
      logger.warn(
        { issueId: issue.id },
        'issue is stuck in INTERVIEWING — run `barf interview --issue <id>` to resume'
      )
    }

    // ── Plan phase ─────────────────────────────────────────────────────────────
    for (const issue of toPlan) {
      const result = await runLoop(issue.id, 'plan', config, provider)
      if (result.isErr()) {
        logger.warn({ issueId: issue.id, err: result.error.message }, 'plan loop failed')
      }
    }

    // ── Build phase ────────────────────────────────────────────────────────────
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
