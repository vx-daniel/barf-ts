import type { Config, IssueState } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { runLoop } from '@/core/batch'
import { triageIssue } from '@/core/triage'
import { createLogger } from '@/utils/logger'

const logger = createLogger('auto')

/** Issue states queued for planning on each {@link autoCommand} loop iteration. */
const PLAN_STATES = new Set<IssueState>(['NEW'])
/** Issue states queued for building on each {@link autoCommand} loop iteration. */
const BUILD_STATES = new Set<IssueState>(['PLANNED', 'IN_PROGRESS'])

/**
 * Continuously orchestrates triage → plan → build until no actionable issues remain.
 *
 * Each iteration:
 * 1. Triages all `NEW` issues where `needs_interview` is undefined (single Claude call per issue).
 * 2. Warns about any `NEW` issues with `needs_interview=true` — these need `/barf-interview` first.
 * 3. Warns about any issues in legacy `INTERVIEWING` state (pre-migration data).
 * 4. Plans all `NEW` issues where `needs_interview` is `false` (or `undefined` for backward compat).
 * 5. Builds up to `opts.batch` `BUILD_STATES` issues concurrently.
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

    // ── Triage phase ───────────────────────────────────────────────────────────
    const toTriage = issues.filter(i => i.state === 'NEW' && i.needs_interview === undefined)
    for (const issue of toTriage) {
      const result = await triageIssue(issue.id, config, provider, undefined, {
        mode: 'triage',
        issueId: issue.id,
        state: issue.state,
        title: issue.title
      })
      if (result.isErr()) {
        logger.warn({ issueId: issue.id, err: result.error.message }, 'triage failed')
      }
    }

    // Re-fetch issues after triage to pick up updated needs_interview flags
    const refreshResult = await provider.listIssues()
    if (refreshResult.isErr()) {
      logger.error({ err: refreshResult.error }, refreshResult.error.message)
      process.exitCode = 1
      return
    }
    const refreshed = refreshResult.value

    // ── Gate check ─────────────────────────────────────────────────────────────
    const needsInterview = refreshed.filter(i => i.state === 'NEW' && i.needs_interview === true)
    for (const issue of needsInterview) {
      logger.warn(
        { issueId: issue.id, title: issue.title },
        `issue needs refinement — run /barf-interview in Claude Code`
      )
    }

    // Migration guard: legacy INTERVIEWING state from pre-triage data
    const legacyInterviewing = refreshed.filter(
      i => (i.state as unknown as string) === 'INTERVIEWING'
    )
    for (const issue of legacyInterviewing) {
      logger.warn(
        { issueId: issue.id },
        'issue is in legacy INTERVIEWING state — manually set state=NEW to reprocess'
      )
    }

    // ── Plan phase ─────────────────────────────────────────────────────────────
    // Plan NEW issues where needs_interview is false (triaged, ready) or undefined (backward compat)
    const toPlan = refreshed.filter(i => PLAN_STATES.has(i.state) && i.needs_interview !== true)
    const toBuild = refreshed.filter(i => BUILD_STATES.has(i.state)).slice(0, opts.batch)

    const hasWork = toPlan.length > 0 || toBuild.length > 0

    if (!hasWork) {
      if (needsInterview.length > 0) {
        logger.info(
          { count: needsInterview.length },
          'no plannable work — some issues are awaiting interview'
        )
      } else {
        logger.info('no actionable issues — done')
      }
      break
    }

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
