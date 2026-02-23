import { ResultAsync } from 'neverthrow'
import { existsSync } from 'fs'
import { join } from 'path'
import type { Config, DisplayContext } from '@/types/index'
import type { IssueProvider } from '@/core/issue/base'
import type { LoopMode } from '@/types/schema/mode-schema'
import type { OverflowDecision } from '@/types/schema/batch-schema'
import { runClaudeIteration } from '@/core/claude'
import { injectTemplateVars } from '@/core/context'
import { resolvePromptTemplate } from '@/core/prompts'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

export type { LoopMode } from '@/types/schema/mode-schema'
export type { OverflowDecision } from '@/types/schema/batch-schema'

const logger = createLogger('batch')

/**
 * Pure: should the loop run another iteration?
 *
 * @category Orchestration
 */
export function shouldContinue(iteration: number, config: Config): boolean {
  return config.maxIterations === 0 || iteration < config.maxIterations
}

/**
 * Pure: given current split count, decide split vs. escalate.
 * split_count < maxAutoSplits  → split (use splitModel)
 * split_count >= maxAutoSplits → escalate (use extendedContextModel)
 *
 * @category Orchestration
 */
export function handleOverflow(splitCount: number, config: Config): OverflowDecision {
  if (splitCount < config.maxAutoSplits) {
    return { action: 'split', nextModel: config.splitModel }
  }
  return { action: 'escalate', nextModel: config.extendedContextModel }
}

/**
 * Resolves the file path for prompt injection.
 * GitHub provider has no local file — returns a placeholder.
 */
export function resolveIssueFile(issueId: string, config: Config): string {
  const md = join(config.issuesDir, `${issueId}.md`)
  if (existsSync(md)) {
    return md
  }
  return issueId // GitHub fallback — prompt receives issue ID only
}

/**
 * Plans each NEW child issue sequentially after a split.
 * No global state mutations — all state passed as arguments.
 */
async function planSplitChildren(
  childIds: string[],
  config: Config,
  provider: IssueProvider
): Promise<void> {
  for (const childId of childIds) {
    const result = await provider.fetchIssue(childId)
    if (result.isErr()) {
      logger.warn({ childId }, 'could not fetch child issue for auto-planning')
      continue
    }
    if (result.value.state !== 'NEW') {
      logger.debug({ childId, state: result.value.state }, 'skipping non-NEW child')
      continue
    }
    logger.info({ childId }, 'auto-planning split child')
    const planResult = await runLoop(childId, 'plan', config, provider)
    if (planResult.isErr()) {
      logger.warn({ childId, error: planResult.error.message }, 'child plan failed')
    }
  }
}

async function runLoopImpl(
  issueId: string,
  mode: LoopMode,
  config: Config,
  provider: IssueProvider
): Promise<void> {
  const lockResult = await provider.lockIssue(issueId, { mode })
  if (lockResult.isErr()) {
    throw lockResult.error
  }

  try {
    let model = mode === 'plan' ? config.planModel : config.buildModel
    let iteration = 0
    let splitPending = false

    // Build mode: transition to IN_PROGRESS on first iteration
    if (mode === 'build') {
      const issueResult = await provider.fetchIssue(issueId)
      if (issueResult.isOk()) {
        const currentState = issueResult.value.state
        if (currentState === 'NEW' || currentState === 'PLANNED') {
          const transitionResult = await provider.transition(issueId, 'IN_PROGRESS')
          if (transitionResult.isErr()) {
            logger.warn({ error: transitionResult.error.message }, 'transition failed')
          }
        }
      }
    }

    // force_split: skip build, enter split flow directly
    if (mode === 'build') {
      const fsIssue = await provider.fetchIssue(issueId)
      if (fsIssue.isOk() && fsIssue.value.force_split) {
        logger.info({ issueId }, 'force_split detected — skipping build')
        const decision = handleOverflow(fsIssue.value.split_count, config)
        if (decision.action === 'split') {
          splitPending = true
          model = decision.nextModel
          await provider.writeIssue(issueId, {
            split_count: fsIssue.value.split_count + 1,
            force_split: false
          })
        } else {
          model = decision.nextModel
        }
      }
    }

    iterationLoop: while (shouldContinue(iteration, config)) {
      const issueResult = await provider.fetchIssue(issueId)
      if (issueResult.isErr()) {
        throw issueResult.error
      }
      if (issueResult.value.state === 'COMPLETED') {
        break
      }

      const currentMode: LoopMode = splitPending ? 'split' : mode
      logger.info({ issueId, mode: currentMode, model, iteration }, 'starting iteration')

      const prompt = injectTemplateVars(resolvePromptTemplate(currentMode, config), {
        BARF_ISSUE_ID: issueId,
        BARF_ISSUE_FILE: resolveIssueFile(issueId, config),
        BARF_MODE: currentMode,
        BARF_ITERATION: iteration,
        ISSUES_DIR: config.issuesDir,
        PLAN_DIR: config.planDir
      })

      const effectiveConfig =
        issueResult.value.context_usage_percent !== undefined
          ? { ...config, contextUsagePercent: issueResult.value.context_usage_percent }
          : config

      const displayContext: DisplayContext = {
        mode: currentMode,
        issueId,
        state: issueResult.value.state,
        title: issueResult.value.title
      }
      const iterResult = await runClaudeIteration(
        prompt,
        model,
        effectiveConfig,
        issueId,
        displayContext
      )
      if (iterResult.isErr()) {
        throw iterResult.error
      }
      const { outcome, tokens } = iterResult.value

      logger.info({ issueId, iteration, outcome, tokens }, 'iteration complete')

      // ── Split iteration completed ──────────────────────────────────────
      if (splitPending) {
        splitPending = false
        const reloaded = await provider.fetchIssue(issueId)
        if (reloaded.isOk() && reloaded.value.state !== 'SPLIT') {
          await provider.transition(issueId, 'SPLIT')
        }
        const fresh = await provider.fetchIssue(issueId)
        if (fresh.isOk() && fresh.value.children.length > 0) {
          await provider.unlockIssue(issueId)
          await planSplitChildren(fresh.value.children, config, provider)
          return
        }
        break iterationLoop
      }

      // ── Handle iteration outcome ───────────────────────────────────────
      if (outcome === 'overflow') {
        const fresh = await provider.fetchIssue(issueId)
        if (fresh.isErr()) {
          throw fresh.error
        }
        const decision = handleOverflow(fresh.value.split_count, config)
        if (decision.action === 'split') {
          splitPending = true
          model = decision.nextModel
          await provider.writeIssue(issueId, {
            split_count: fresh.value.split_count + 1
          })
        } else {
          model = decision.nextModel
          logger.info({ newModel: model }, 'escalating to extended context model')
        }
        continue iterationLoop
      }

      if (outcome === 'rate_limited') {
        const resetsAt = iterResult.value.rateLimitResetsAt
        const timeStr = resetsAt ? new Date(resetsAt * 1000).toLocaleTimeString() : 'soon'
        throw new Error(`Rate limited until ${timeStr}`)
      }

      if (outcome === 'error') {
        logger.warn({ issueId, iteration }, 'claude returned error — stopping loop')
        break iterationLoop
      }

      // ── Normal success — check completion ──────────────────────────────

      // Plan mode: single iteration, then check for plan file
      if (mode === 'plan') {
        const planFile = join(config.planDir, `${issueId}.md`)
        if (existsSync(planFile)) {
          const fresh = await provider.fetchIssue(issueId)
          if (fresh.isOk() && fresh.value.state !== 'PLANNED') {
            await provider.transition(issueId, 'PLANNED')
          }
        }
        break iterationLoop // plan mode is always single iteration
      }

      // Build mode: check acceptance criteria + optional test command
      if (mode === 'build') {
        const criteriaResult = await provider.checkAcceptanceCriteria(issueId)
        const criteriaMet = criteriaResult.isOk() && criteriaResult.value

        if (criteriaMet) {
          let testsPassed = true
          if (config.testCommand) {
            const testResult = await execFileNoThrow('sh', ['-c', config.testCommand])
            testsPassed = testResult.status === 0
            if (!testsPassed) {
              logger.warn({ issueId, iteration }, 'tests failed — continuing')
            }
          }
          if (testsPassed) {
            const fresh = await provider.fetchIssue(issueId)
            if (fresh.isOk() && fresh.value.state !== 'COMPLETED') {
              await provider.transition(issueId, 'COMPLETED')
            }
            break iterationLoop
          }
        }
      }

      iteration++
    }
  } finally {
    await provider.unlockIssue(issueId)
  }
}

/**
 * Core orchestration loop. Runs Claude iterations until the issue reaches a
 * terminal state or `config.maxIterations` is exhausted.
 *
 * No globals — all state passed as arguments. Handles state transitions,
 * context overflow (split/escalate), plan file detection, acceptance criteria,
 * and optional test validation.
 *
 * @param issueId - ID of the issue to process.
 * @param mode - `'plan'` runs one iteration then checks for a plan file; `'build'` loops until COMPLETED.
 * @param config - Loaded barf configuration.
 * @param provider - Issue provider used to lock, read, and write the issue.
 * @returns `ok(void)` when the loop exits cleanly, `err(Error)` if locking or a Claude iteration fails.
 * @category Orchestration
 */
export function runLoop(
  issueId: string,
  mode: LoopMode,
  config: Config,
  provider: IssueProvider
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(runLoopImpl(issueId, mode, config, provider), toError)
}
