/**
 * Iteration outcome handlers — extracted decision branches from the main loop.
 *
 * Each function handles one specific outcome from a Claude iteration:
 * split completion, overflow, plan completion, or build completion.
 * By extracting these into named functions, the main loop becomes a
 * clean dispatcher that's easy to read and test.
 *
 * @module Orchestration
 */
import { existsSync } from 'fs'
import { join } from 'path'
import type { Config, DisplayContext, SessionStats } from '@/types'
import type { LoopMode } from '@/types/schema/mode-schema'
import type { IterationResult } from '@/types/schema/claude-schema'
import type { IssueProvider } from '@/core/issue/base'
import { type runPreComplete, toFixSteps } from '@/core/pre-complete'
import type { verifyIssue } from '@/core/verification'
import { createLogger } from '@/utils/logger'
import { handleOverflow } from './helpers'
import { createSessionStats, persistSessionStats } from './stats'

const logger = createLogger('batch')

/**
 * Mutable loop state passed between the main loop and outcome handlers.
 *
 * This object is mutated in place by outcome handlers to communicate
 * state changes back to the main loop (e.g. switching models after overflow,
 * toggling `splitPending` after an overflow decision).
 *
 * @category Orchestration
 */
export type LoopState = {
  /** Whether the next iteration should run in split mode. */
  splitPending: boolean
  /** Current model identifier (may change after overflow/escalation). */
  model: string
  /** Zero-based iteration counter. */
  iteration: number
  /** Number of Claude iterations that actually ran (incremented before each Claude call). */
  iterationsRan: number
  /** Cumulative input tokens across all iterations. */
  totalInputTokens: number
  /** Cumulative output tokens across all iterations. */
  totalOutputTokens: number
  /** Token count from the most recent iteration (for stats). */
  lastContextSize: number
  /** Unix timestamp (ms) when the session started. */
  sessionStartTime: number
}

/**
 * Injectable dependencies for outcome handlers.
 *
 * These mirror the `RunLoopDeps` type but are resolved (non-optional)
 * by the time they reach outcome handlers.
 *
 * @category Orchestration
 */
export type OutcomeDeps = {
  verifyIssue: typeof verifyIssue
  runPreComplete: typeof runPreComplete
}

/**
 * Handles the completion of a split iteration.
 *
 * After a split iteration completes, this handler:
 * 1. Transitions the issue to SPLIT state
 * 2. Persists session stats (before unlocking)
 * 3. Unlocks the issue
 * 4. Plans each NEW child issue sequentially
 *
 * Returns `'return'` to signal the main loop should exit, or `'break'`
 * if no children were created (split produced no sub-issues).
 *
 * @param issueId - ID of the parent issue being split.
 * @param config - Barf configuration.
 * @param provider - Issue provider for state transitions and I/O.
 * @param state - Mutable loop state.
 * @param planSplitChildren - Function to plan child issues after split.
 * @param deps - Injectable dependencies forwarded to child planning.
 * @returns `'return'` if children were planned (caller should exit), `'break'` otherwise.
 * @category Orchestration
 */
export async function handleSplitCompletion(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  state: LoopState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- circular type: runLoop references planSplitChildren
  planSplitChildren: (...args: any[]) => Promise<void>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- circular type between loop.ts and helpers.ts
  runLoop: any,
  deps: Record<string, unknown>,
): Promise<'return' | 'break'> {
  state.splitPending = false
  const reloaded = await provider.fetchIssue(issueId)
  if (reloaded.isOk() && reloaded.value.state !== 'SPLIT') {
    await provider.transition(issueId, 'SPLIT')
  }
  const fresh = await provider.fetchIssue(issueId)
  if (fresh.isOk() && fresh.value.children.length > 0) {
    const stats = createSessionStats(
      state.sessionStartTime,
      state.totalInputTokens,
      state.totalOutputTokens,
      state.lastContextSize,
      state.iterationsRan,
      state.model,
    )
    await persistSessionStats(issueId, stats, provider)
    state.iterationsRan = 0 // neutralize the finally-block guard (already persisted)
    await provider.unlockIssue(issueId)
    await planSplitChildren(
      fresh.value.children,
      config,
      provider,
      runLoop,
      deps,
    )
    return 'return'
  }
  return 'break'
}

/**
 * Handles a context overflow outcome from a Claude iteration.
 *
 * When Claude's context window usage exceeds the configured threshold,
 * this handler decides whether to split the issue or escalate to a
 * larger context model. Mutates `state.splitPending` and `state.model`
 * to communicate the decision back to the main loop.
 *
 * @param issueId - ID of the issue that overflowed.
 * @param config - Barf configuration.
 * @param provider - Issue provider for reading/writing split count.
 * @param state - Mutable loop state (model and splitPending are updated).
 * @category Orchestration
 */
export async function handleOverflowOutcome(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  state: LoopState,
): Promise<void> {
  const fresh = await provider.fetchIssue(issueId)
  if (fresh.isErr()) {
    throw fresh.error
  }
  const decision = handleOverflow(fresh.value.split_count, config)
  if (decision.action === 'split') {
    state.splitPending = true
    state.model = decision.nextModel
    await provider.writeIssue(issueId, {
      split_count: fresh.value.split_count + 1,
    })
  } else {
    state.model = decision.nextModel
    logger.info(
      { newModel: state.model },
      'escalating to extended context model',
    )
  }
}

/**
 * Handles plan mode completion after a single iteration.
 *
 * In plan mode, Claude runs exactly one iteration. If a plan file exists
 * at `{planDir}/{issueId}.md` after the iteration, the issue is transitioned
 * to PLANNED state.
 *
 * @param issueId - ID of the issue being planned.
 * @param config - Barf configuration containing `planDir`.
 * @param provider - Issue provider for state transitions.
 * @category Orchestration
 */
export async function handlePlanCompletion(
  issueId: string,
  config: Config,
  provider: IssueProvider,
): Promise<void> {
  const planFile = join(config.planDir, `${issueId}.md`)
  if (existsSync(planFile)) {
    const fresh = await provider.fetchIssue(issueId)
    if (fresh.isOk() && fresh.value.state !== 'PLANNED') {
      await provider.transition(issueId, 'PLANNED')
    }
  }
}

/**
 * Handles build mode completion when acceptance criteria are met.
 *
 * This handler runs the pre-completion gate (fix commands + test gate),
 * and if it passes, transitions the issue to COMPLETED and immediately
 * triggers verification.
 *
 * @param issueId - ID of the issue being built.
 * @param config - Barf configuration.
 * @param provider - Issue provider for state transitions.
 * @param deps - Injectable dependencies (verifyIssue, runPreComplete).
 * @returns `'break'` if the issue was completed (caller should exit loop),
 *   `'continue'` if pre-complete failed and the loop should continue.
 * @category Orchestration
 */
export async function handleBuildCompletion(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  deps: OutcomeDeps,
  iteration: number,
): Promise<'break' | 'continue'> {
  const criteriaResult = await provider.checkAcceptanceCriteria(issueId)
  const criteriaMet = criteriaResult.isOk() && criteriaResult.value

  if (!criteriaMet) {
    return 'continue'
  }

  const fixSteps = toFixSteps(config.fixCommands)
  const preResult = await deps.runPreComplete(
    fixSteps,
    config.testCommand || undefined,
  )
  const preOutcome = preResult._unsafeUnwrap()

  if (preOutcome.passed) {
    const fresh = await provider.fetchIssue(issueId)
    if (fresh.isOk() && fresh.value.state !== 'COMPLETED') {
      await provider.transition(issueId, 'COMPLETED')
    }
    // Run verification immediately after COMPLETED
    const verifyResult = await deps.verifyIssue(issueId, config, provider)
    if (verifyResult.isErr()) {
      logger.warn(
        { issueId, err: verifyResult.error.message },
        'verification failed after COMPLETED',
      )
    }
    return 'break'
  }

  logger.warn(
    { issueId, iteration },
    'pre-complete failed — continuing',
  )
  return 'continue'
}
