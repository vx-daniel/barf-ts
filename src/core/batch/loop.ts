/**
 * Main orchestration loop — the heart of barf's issue processing.
 *
 * The loop runs Claude iterations on an issue until it reaches a terminal
 * state (COMPLETED/VERIFIED) or the iteration limit is exhausted. Each
 * iteration's outcome is dispatched to a specific handler in `outcomes.ts`.
 *
 * The loop manages:
 * - Issue locking (acquired at start, released in `finally`)
 * - Model selection (plan vs build, with overflow escalation)
 * - Prompt template resolution and variable injection
 * - Session stats persistence (best-effort, in `finally`)
 *
 * @module Orchestration
 */
import { ResultAsync } from 'neverthrow'
import { runClaudeIteration } from '@/core/claude'
import { injectTemplateVars } from '@/core/context'
import type { IssueProvider } from '@/core/issue/base'
import { runPreComplete } from '@/core/pre-complete'
import { resolvePromptTemplate } from '@/core/prompts'
import { verifyIssue } from '@/core/verification'
import type { Config, DisplayContext } from '@/types'
import type { LoopMode } from '@/types/schema/mode-schema'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import {
  handleOverflow,
  planSplitChildren,
  resolveIssueFile,
  shouldContinue,
} from './helpers'
import {
  type LoopState,
  handleBuildCompletion,
  handleOverflowOutcome,
  handlePlanCompletion,
  handleSplitCompletion,
} from './outcomes'
import { createSessionStats, persistSessionStats } from './stats'

const logger = createLogger('batch')

/**
 * Injectable dependencies for {@link runLoop}. Pass mocks in tests.
 *
 * All fields are optional — when omitted, the real implementations are used.
 * This enables isolated unit testing of the orchestration loop without
 * spawning Claude processes or writing to the filesystem.
 *
 * @category Orchestration
 */
export type RunLoopDeps = {
  /** Override the Claude iteration runner (for testing). */
  runClaudeIteration?: typeof runClaudeIteration
  /** Override the verification runner (for testing). */
  verifyIssue?: typeof verifyIssue
  /** Override the pre-completion gate (for testing). */
  runPreComplete?: typeof runPreComplete
}

/**
 * Internal implementation of the orchestration loop.
 *
 * Separated from {@link runLoop} so the public API can wrap it in
 * `ResultAsync.fromPromise` for consistent neverthrow error handling.
 */
async function runLoopImpl(
  issueId: string,
  mode: LoopMode,
  config: Config,
  provider: IssueProvider,
  deps: RunLoopDeps,
): Promise<void> {
  const _runClaudeIteration = deps.runClaudeIteration ?? runClaudeIteration
  const _verifyIssue = deps.verifyIssue ?? verifyIssue
  const _runPreComplete = deps.runPreComplete ?? runPreComplete
  const lockResult = await provider.lockIssue(issueId, { mode })
  if (lockResult.isErr()) {
    throw lockResult.error
  }

  const state: LoopState = {
    splitPending: false,
    model: mode === 'plan' ? config.planModel : config.buildModel,
    iteration: 0,
    iterationsRan: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    lastContextSize: 0,
    sessionStartTime: Date.now(),
  }

  try {
    // Build mode: transition to IN_PROGRESS on first iteration
    if (mode === 'build') {
      const issueResult = await provider.fetchIssue(issueId)
      if (issueResult.isOk()) {
        const currentState = issueResult.value.state
        if (currentState === 'PLANNED') {
          const transitionResult = await provider.transition(
            issueId,
            'IN_PROGRESS',
          )
          if (transitionResult.isErr()) {
            logger.warn(
              { error: transitionResult.error.message },
              'transition failed',
            )
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
          state.splitPending = true
          state.model = decision.nextModel
          await provider.writeIssue(issueId, {
            split_count: fsIssue.value.split_count + 1,
            force_split: false,
          })
        } else {
          state.model = decision.nextModel
        }
      }
    }

    while (shouldContinue(state.iteration, config)) {
      const issueResult = await provider.fetchIssue(issueId)
      if (issueResult.isErr()) {
        throw issueResult.error
      }
      if (issueResult.value.state === 'COMPLETED') {
        break
      }

      const currentMode: LoopMode = state.splitPending ? 'split' : mode
      state.iterationsRan++
      logger.info(
        {
          issueId,
          mode: currentMode,
          model: state.model,
          iteration: state.iteration,
        },
        'starting iteration',
      )

      const prompt = injectTemplateVars(
        resolvePromptTemplate(currentMode, config),
        {
          BARF_ISSUE_ID: issueId,
          BARF_ISSUE_FILE: resolveIssueFile(issueId, config),
          BARF_MODE: currentMode,
          BARF_ITERATION: state.iteration,
          ISSUES_DIR: config.issuesDir,
          PLAN_DIR: config.planDir,
        },
      )

      const effectiveConfig =
        issueResult.value.context_usage_percent !== undefined
          ? {
              ...config,
              contextUsagePercent: issueResult.value.context_usage_percent,
            }
          : config

      const displayContext: DisplayContext = {
        mode: currentMode,
        issueId,
        state: issueResult.value.state,
        title: issueResult.value.title,
      }
      const iterResult = await _runClaudeIteration(
        prompt,
        state.model,
        effectiveConfig,
        issueId,
        displayContext,
      )
      if (iterResult.isErr()) {
        throw iterResult.error
      }
      const { outcome, tokens, outputTokens } = iterResult.value
      state.totalInputTokens += tokens
      state.totalOutputTokens += outputTokens
      state.lastContextSize = tokens

      logger.info(
        {
          issueId,
          iteration: state.iteration,
          outcome,
          tokens,
          outputTokens,
          totalInputTokens: state.totalInputTokens,
          totalOutputTokens: state.totalOutputTokens,
        },
        'iteration complete',
      )

      process.stdout.write(
        `__BARF_STATS__:${JSON.stringify({
          totalInputTokens: state.totalInputTokens,
          totalOutputTokens: state.totalOutputTokens,
          contextSize: state.lastContextSize,
          iteration: state.iteration,
        })}\n`,
      )

      // ── Dispatch outcome ─────────────────────────────────────────────
      if (state.splitPending) {
        const action = await handleSplitCompletion(
          issueId,
          config,
          provider,
          state,
          planSplitChildren,
          runLoop,
          deps,
        )
        if (action === 'return') return
        break
      }

      if (outcome === 'overflow') {
        await handleOverflowOutcome(issueId, config, provider, state)
        continue
      }

      if (outcome === 'rate_limited') {
        const resetsAt = iterResult.value.rateLimitResetsAt
        const timeStr = resetsAt
          ? new Date(resetsAt * 1000).toLocaleTimeString()
          : 'soon'
        throw new Error(`Rate limited until ${timeStr}`)
      }

      if (outcome === 'error') {
        logger.warn(
          { issueId, iteration: state.iteration },
          'claude returned error — stopping loop',
        )
        break
      }

      // ── Normal success — check completion ────────────────────────────
      if (mode === 'plan') {
        await handlePlanCompletion(issueId, config, provider)
        break // plan mode is always single iteration
      }

      if (mode === 'build') {
        const buildAction = await handleBuildCompletion(
          issueId,
          config,
          provider,
          { verifyIssue: _verifyIssue, runPreComplete: _runPreComplete },
          state.iteration,
        )
        if (buildAction === 'break') break
      }

      state.iteration++
    }
  } finally {
    const stats = createSessionStats(
      state.sessionStartTime,
      state.totalInputTokens,
      state.totalOutputTokens,
      state.lastContextSize,
      state.iterationsRan,
      state.model,
    )
    if (state.iterationsRan > 0) {
      await persistSessionStats(issueId, stats, provider)
    }
    await provider.unlockIssue(issueId)
  }
}

/**
 * Core orchestration loop. Runs Claude iterations until the issue reaches a
 * terminal state or `config.maxIterations` is exhausted.
 *
 * No globals — all state passed as arguments. The loop handles:
 * - State transitions (IN_PROGRESS on start, PLANNED/COMPLETED/SPLIT on exit)
 * - Context overflow decisions (split vs escalate to larger model)
 * - Plan file detection (plan mode exits after one iteration)
 * - Acceptance criteria checking and pre-completion gate (build mode)
 * - Post-COMPLETED verification
 * - Session stats persistence (best-effort)
 * - Issue locking/unlocking (POSIX file locks)
 *
 * @param issueId - ID of the issue to process.
 * @param mode - `'plan'` runs one iteration then checks for a plan file; `'build'` loops until COMPLETED.
 * @param config - Loaded barf configuration.
 * @param provider - Issue provider used to lock, read, and write the issue.
 * @param deps - Injectable dependencies; pass `{ runClaudeIteration: mockFn }` in tests.
 * @returns `ok(void)` when the loop exits cleanly, `err(Error)` if locking or a Claude iteration fails.
 * @category Orchestration
 */
export function runLoop(
  issueId: string,
  mode: LoopMode,
  config: Config,
  provider: IssueProvider,
  deps: RunLoopDeps = {},
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    runLoopImpl(issueId, mode, config, provider, deps),
    toError,
  )
}
