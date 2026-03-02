/** @module CLI Commands */
import {
  checkAutoTrigger,
  createLimiter,
  incrementCompleted,
  makeAutoSessionId,
  type RunLoopDeps,
  readAuditGate,
  resetAuditGate,
  runLoop,
  transitionToAuditing,
  transitionToFixing,
  triggerAuditGate,
  writeAuditGateEvent,
  writeAutoEnd,
  writeAutoStart,
} from '@/core/batch'
import type { IssueProvider } from '@/core/issue/base'
import { triageIssue } from '@/core/triage'
import { verifyIssue } from '@/core/verification'
import type { Config, Issue, IssueState } from '@/types'
import { createLogger } from '@/utils/logger'
import { type AuditDeps, auditIssue } from './audit'

const logger = createLogger('auto')

/**
 * Injectable dependencies for {@link autoCommand}.
 * Pass mocks in tests to avoid spawning real Claude processes.
 */
export type AutoDeps = {
  triageIssue?: typeof triageIssue
  runClaudeIteration?: RunLoopDeps['runClaudeIteration']
  verifyIssue?: typeof verifyIssue
  auditDeps?: AuditDeps
}

/** Issue states queued for planning on each {@link autoCommand} loop iteration. */
const PLAN_STATES = new Set<IssueState>(['GROOMED'])
/** Issue states queued for building on each {@link autoCommand} loop iteration. */
const BUILD_STATES = new Set<IssueState>(['PLANNED'])

/**
 * Continuously orchestrates triage → plan → build → verify → audit until no actionable issues remain.
 *
 * Each iteration:
 * 1. Reads the audit gate state and handles state machine transitions.
 * 2. Triages all `NEW` issues where `needs_interview` is undefined.
 * 3. Plans all `GROOMED` issues (skipped if gate is draining/auditing/fixing).
 * 4. Builds up to `opts.batch` `BUILD_STATES` issues concurrently (skipped/filtered by gate).
 * 5. Verifies BUILT issues.
 * 6. Checks audit gate auto-trigger and handles auditing/fixing phases.
 *
 * The loop exits when all queues are empty or the provider returns an error.
 *
 * @param provider - Issue provider supplying and persisting issues.
 * @param opts - `batch`: max concurrent builds; `max`: reserved; `auditGate`: enable audit gate.
 * @param config - Loaded barf configuration.
 */
export async function autoCommand(
  provider: IssueProvider,
  opts: { batch: number; max: number; auditGate: boolean },
  config: Config,
  deps: AutoDeps = {},
): Promise<void> {
  const _triageIssue = deps.triageIssue ?? triageIssue
  const _verifyIssue = deps.verifyIssue ?? verifyIssue
  const loopDeps: RunLoopDeps = {
    runClaudeIteration: deps.runClaudeIteration,
    verifyIssue: deps.verifyIssue,
  }

  // If --audit-gate is set but config has no threshold, default to 10
  const effectiveConfig =
    opts.auditGate && config.auditAfterNCompleted <= 0
      ? { ...config, auditAfterNCompleted: 10 }
      : config

  const autoSessionId = makeAutoSessionId()
  writeAutoStart(config.barfDir, autoSessionId)
  let totalIssuesProcessed = 0

  try {
    while (true) {
      const listResult = await provider.listIssues()
      if (listResult.isErr()) {
        logger.error({ err: listResult.error }, listResult.error.message)
        process.exitCode = 1
        return
      }

      const issues = listResult.value

      // ── Audit gate state machine ────────────────────────────────────────────
      const gate = readAuditGate(config.barfDir)

      // Auto-trigger check
      if (opts.auditGate && checkAutoTrigger(gate, effectiveConfig)) {
        triggerAuditGate(config.barfDir, 'auto')
        writeAuditGateEvent(config.barfDir, 'draining', {
          triggeredBy: 'auto',
        })
        // Re-read gate after trigger
        const updatedGate = readAuditGate(config.barfDir)
        if (updatedGate.state === 'draining') {
          // Transition immediately to auditing since we're at a loop boundary
          // (no active sessions within the auto loop at this point)
          transitionToAuditing(config.barfDir)
          writeAuditGateEvent(config.barfDir, 'auditing')
        }
      }

      // Re-read gate after potential trigger
      const currentGate = readAuditGate(config.barfDir)

      // Handle auditing phase
      if (currentGate.state === 'auditing') {
        logger.info('audit gate: running audit on BUILT issues')
        const completed = issues.filter((i) => i.state === 'BUILT')

        const fixIssueIds: string[] = []
        for (const issue of completed) {
          // auditIssue creates findings issues via provider.createIssue
          // We need to capture the created issue IDs
          const beforeList = await provider.listIssues()
          await auditIssue(issue.id, config, provider, deps.auditDeps ?? {})
          const afterList = await provider.listIssues()

          if (beforeList.isOk() && afterList.isOk()) {
            const beforeIds = new Set(beforeList.value.map((i) => i.id))
            const newIssues = afterList.value.filter(
              (i) => !beforeIds.has(i.id),
            )
            for (const newIssue of newIssues) {
              fixIssueIds.push(newIssue.id)
            }
          }
        }

        if (fixIssueIds.length > 0) {
          transitionToFixing(config.barfDir, fixIssueIds)
          writeAuditGateEvent(config.barfDir, 'fixing', {
            fixIssueCount: fixIssueIds.length,
          })
          logger.info(
            { fixIssueCount: fixIssueIds.length },
            'audit gate: findings created — entering fixing phase',
          )
        } else {
          resetAuditGate(config.barfDir)
          writeAuditGateEvent(config.barfDir, 'completed')
          logger.info('audit gate: no findings — resuming normal operation')
        }
        continue // Re-enter loop to pick up new state
      }

      // Handle fixing phase: only build audit fix issues
      if (currentGate.state === 'fixing') {
        const fixIds = new Set(currentGate.auditFixIssueIds)
        const fixIssues = issues.filter(
          (i) => fixIds.has(i.id) && BUILD_STATES.has(i.state),
        )
        const fixGroomed = issues.filter(
          (i) => fixIds.has(i.id) && PLAN_STATES.has(i.state),
        )

        // Plan fix issues that need planning
        for (const issue of fixGroomed) {
          totalIssuesProcessed++
          const result = await runLoop(
            issue.id,
            'plan',
            config,
            provider,
            loopDeps,
            autoSessionId,
          )
          if (result.isErr()) {
            logger.warn(
              { issueId: issue.id, err: result.error.message },
              'audit fix plan failed',
            )
          }
        }

        // Build fix issues
        if (fixIssues.length > 0) {
          const limit = createLimiter(opts.batch)
          const results = await Promise.allSettled(
            fixIssues.map((i) =>
              limit(() => {
                totalIssuesProcessed++
                return runLoop(
                  i.id,
                  'build',
                  config,
                  provider,
                  loopDeps,
                  autoSessionId,
                )
              }),
            ),
          )
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value.isErr()) {
              logger.warn(
                { err: r.value.error.message },
                'audit fix build failed',
              )
            }
          }
        }

        // Check if all fix issues are done
        const refreshResult = await provider.listIssues()
        if (refreshResult.isOk()) {
          const allFixesDone = currentGate.auditFixIssueIds.every((id) => {
            const issue = refreshResult.value.find((i) => i.id === id)
            return (
              issue &&
              (issue.state === 'BUILT' ||
                issue.state === 'COMPLETE' ||
                issue.state === 'SPLIT')
            )
          })

          if (allFixesDone) {
            resetAuditGate(config.barfDir)
            writeAuditGateEvent(config.barfDir, 'completed')
            logger.info(
              'audit gate: all fix issues resolved — resuming normal operation',
            )
          } else {
            // Some fixes still need work — check if there's any buildable work left
            const stillBuildable = currentGate.auditFixIssueIds.some((id) => {
              const issue = refreshResult.value.find((i) => i.id === id)
              return (
                issue &&
                (BUILD_STATES.has(issue.state) ||
                  PLAN_STATES.has(issue.state) ||
                  issue.state === 'NEW')
              )
            })
            if (!stillBuildable) {
              // All fixes are in terminal or stuck states but not all completed
              logger.warn('audit gate: fix issues stuck — resetting gate')
              resetAuditGate(config.barfDir)
              writeAuditGateEvent(config.barfDir, 'completed')
            }
          }
        }

        continue // Re-enter loop
      }

      // Handle draining phase (triggered externally via dashboard/CLI)
      if (currentGate.state === 'draining') {
        // At the top of the auto loop, no sessions are running
        // (they only run within the plan/build phases below)
        // So we can transition directly to auditing
        transitionToAuditing(config.barfDir)
        writeAuditGateEvent(config.barfDir, 'auditing')
        continue
      }

      // ── Normal operation (gate.state === 'running') ──────────────────────────

      // ── Triage phase ───────────────────────────────────────────────────────────
      const toTriage = issues.filter(
        (i) => i.state === 'NEW' && i.needs_interview === undefined,
      )
      for (const issue of toTriage) {
        const result = await _triageIssue(
          issue.id,
          config,
          provider,
          undefined,
          {
            mode: 'triage',
            issueId: issue.id,
            state: issue.state,
            title: issue.title,
          },
        )
        if (result.isErr()) {
          logger.warn(
            { issueId: issue.id, err: result.error.message },
            'triage failed',
          )
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
      const needsInterview = refreshed.filter((i) => i.needs_interview === true)
      for (const issue of needsInterview) {
        logger.warn(
          { issueId: issue.id, title: issue.title },
          `issue needs refinement — run /barf-interview in Claude Code`,
        )
      }

      // Migration guard: legacy INTERVIEWING state from pre-triage data
      const legacyInterviewing = refreshed.filter(
        (i) => (i.state as unknown as string) === 'INTERVIEWING',
      )
      for (const issue of legacyInterviewing) {
        logger.warn(
          { issueId: issue.id },
          'issue is in legacy INTERVIEWING state — manually set state=NEW to reprocess',
        )
      }

      // ── Plan phase ─────────────────────────────────────────────────────────────
      // Plan GROOMED issues — they've already passed triage
      const toPlan = refreshed.filter((i) => PLAN_STATES.has(i.state))
      const toBuild = refreshed.filter((i) => BUILD_STATES.has(i.state))

      // BUILT issues that still need verification (not fix-children, not exhausted)
      const toVerify = refreshed.filter(
        (i) =>
          i.state === 'BUILT' &&
          !i.is_verify_fix &&
          i.verify_count > 0 &&
          !i.verify_exhausted,
      )

      const hasWork =
        toPlan.length > 0 || toBuild.length > 0 || toVerify.length > 0

      if (!hasWork) {
        if (needsInterview.length > 0) {
          logger.info(
            { count: needsInterview.length },
            'no plannable work — some issues are awaiting interview',
          )
        } else {
          logger.info('no actionable issues — done')
        }
        break
      }

      for (const issue of toPlan) {
        totalIssuesProcessed++
        const result = await runLoop(
          issue.id,
          'plan',
          config,
          provider,
          loopDeps,
          autoSessionId,
        )
        if (result.isErr()) {
          logger.warn(
            { issueId: issue.id, err: result.error.message },
            'plan loop failed',
          )
        }
      }

      // ── Build phase ────────────────────────────────────────────────────────────
      if (toBuild.length > 0) {
        const limit = createLimiter(opts.batch)
        const results = await Promise.allSettled(
          toBuild.map((i) =>
            limit(() => {
              totalIssuesProcessed++
              return runLoop(
                i.id,
                'build',
                config,
                provider,
                loopDeps,
                autoSessionId,
              )
            }),
          ),
        )

        // Track completed builds for audit gate counter
        let completedInBatch = 0
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.isOk()) {
            completedInBatch++
          } else if (r.status === 'fulfilled' && r.value.isErr()) {
            logger.warn({ err: r.value.error.message }, 'build loop failed')
          }
        }

        // Increment audit gate counter for completed builds
        if (opts.auditGate && completedInBatch > 0) {
          for (let i = 0; i < completedInBatch; i++) {
            incrementCompleted(config.barfDir)
          }
        }
      }

      // ── Verify phase ────────────────────────────────────────────────────────────
      for (const issue of toVerify) {
        // Only re-verify once all fix-children are done
        const childResults = await Promise.all(
          issue.children.map((id) => provider.fetchIssue(id)),
        )
        const fixChildren = childResults
          .filter((r) => r.isOk())
          .map((r) => (r as { isOk: () => true; value: Issue }).value)
          .filter((c) => c.is_verify_fix === true)
        const allDone = fixChildren.every(
          (c) => c.state === 'BUILT' || c.state === 'COMPLETE',
        )
        if (!allDone) {
          logger.debug(
            { issueId: issue.id },
            'verify phase: fix children still in progress',
          )
          continue
        }

        const result = await _verifyIssue(issue.id, config, provider)
        if (result.isErr()) {
          logger.warn(
            { issueId: issue.id, err: result.error.message },
            'verify phase failed',
          )
        }
      }
    }
  } finally {
    writeAutoEnd(config.barfDir, autoSessionId, totalIssuesProcessed)
  }
}
