/** @module CLI Commands */

import { readAuditGate, runLoop } from '@/core/batch'
import type { IssueProvider } from '@/core/issue/base'
import type { Config, IssueState } from '@/types'
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
 * Respects the audit gate: when the gate is in `draining` or `auditing` state,
 * builds are fully paused. When in `fixing` state, only audit fix issues can build.
 *
 * @param provider - Issue provider supplying and persisting issues.
 * @param opts - `issue`: explicit issue ID; `batch`: concurrency limit; `max`: iteration cap (0 = use `config`).
 * @param config - Loaded barf configuration.
 */
export async function buildCommand(
  provider: IssueProvider,
  opts: { issue?: string; batch: number; max: number },
  config: Config,
): Promise<void> {
  // --max overrides config.maxIterations for this invocation only
  const effectiveConfig =
    opts.max > 0 ? { ...config, maxIterations: opts.max } : config

  // ── Audit gate check ────────────────────────────────────────────────────────
  const gate = readAuditGate(config.barfDir)

  if (gate.state === 'draining' || gate.state === 'auditing') {
    logger.warn(
      { gateState: gate.state },
      'audit gate active — builds are paused until the audit completes',
    )
    return
  }

  if (opts.issue) {
    // In fixing mode, only allow audit fix issues
    if (
      gate.state === 'fixing' &&
      !gate.auditFixIssueIds.includes(opts.issue)
    ) {
      logger.warn(
        { issueId: opts.issue, gateState: gate.state },
        'audit gate active — only audit fix issues can build',
      )
      return
    }

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
  const BUILDABLE = new Set<IssueState>(['IN_PROGRESS', 'PLANNED', 'NEW'])
  let candidates = listResult.value.filter((i) => BUILDABLE.has(i.state))

  // In fixing mode, filter to only audit fix issues
  if (gate.state === 'fixing') {
    const fixIds = new Set(gate.auditFixIssueIds)
    candidates = candidates.filter((i) => fixIds.has(i.id))
    if (candidates.length === 0) {
      logger.warn('audit gate active — no audit fix issues available to build')
      return
    }
    logger.info(
      { count: candidates.length },
      'audit gate: building only audit fix issues',
    )
  }

  if (candidates.length === 0) {
    logger.info('No issues available for building.')
    return
  }

  logger.info(
    { count: candidates.length, concurrency: opts.batch },
    'Building issues',
  )

  const results = await Promise.allSettled(
    candidates
      .slice(0, opts.batch)
      .map((issue) => runLoop(issue.id, 'build', effectiveConfig, provider)),
  )

  let failures = 0
  for (const [i, r] of results.entries()) {
    const id = candidates[i]?.id
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
