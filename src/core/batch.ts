import { ResultAsync } from 'neverthrow';
import { existsSync } from 'fs';
import { join } from 'path';
import type { Config } from '../types/index.js';
import type { IssueProvider } from './issue-providers/base.js';
import { runClaudeIteration } from './claude.js';
import { injectPromptVars } from './context.js';
import { execFileNoThrow } from '../utils/execFileNoThrow.js';
import { createLogger } from '../utils/logger.js';

// Prompt templates — embedded into binary at compile time via Bun import attributes
import planPromptTemplate from '../prompts/PROMPT_plan.md' with { type: 'text' };
import buildPromptTemplate from '../prompts/PROMPT_build.md' with { type: 'text' };
import splitPromptTemplate from '../prompts/PROMPT_split.md' with { type: 'text' };

const logger = createLogger('batch');

export type LoopMode = 'plan' | 'build' | 'split';

const PROMPT_TEMPLATES: Record<LoopMode, string> = {
  plan:  planPromptTemplate,
  build: buildPromptTemplate,
  split: splitPromptTemplate,
};

export interface OverflowDecision {
  action: 'split' | 'escalate';
  nextModel: string;
}

/** Pure: should the loop run another iteration? */
export function shouldContinue(iteration: number, config: Config): boolean {
  return config.maxIterations === 0 || iteration < config.maxIterations;
}

/**
 * Pure: given current split count, decide split vs. escalate.
 * split_count < maxAutoSplits  → split (use splitModel)
 * split_count >= maxAutoSplits → escalate (use extendedContextModel)
 */
export function handleOverflow(splitCount: number, config: Config): OverflowDecision {
  if (splitCount < config.maxAutoSplits) {
    return { action: 'split', nextModel: config.splitModel };
  }
  return { action: 'escalate', nextModel: config.extendedContextModel };
}

/**
 * Resolves the file path for prompt injection.
 * Prefers .working file (locked) over .md (unlocked).
 * GitHub provider has no local file — returns a placeholder.
 */
function resolveIssueFile(issueId: string, config: Config): string {
  const working = join(config.issuesDir, `${issueId}.md.working`);
  if (existsSync(working)) return working;
  const md = join(config.issuesDir, `${issueId}.md`);
  if (existsSync(md)) return md;
  return issueId; // GitHub fallback — prompt receives issue ID only
}

/**
 * Plans each NEW child issue sequentially after a split.
 * No global state mutations — all state passed as arguments.
 */
async function planSplitChildren(
  childIds: string[],
  config: Config,
  provider: IssueProvider,
): Promise<void> {
  for (const childId of childIds) {
    const result = await provider.fetchIssue(childId);
    if (result.isErr()) {
      logger.warn({ childId }, 'could not fetch child issue for auto-planning');
      continue;
    }
    if (result.value.state !== 'NEW') {
      logger.debug({ childId, state: result.value.state }, 'skipping non-NEW child');
      continue;
    }
    logger.info({ childId }, 'auto-planning split child');
    const planResult = await runLoop(childId, 'plan', config, provider);
    if (planResult.isErr()) {
      logger.warn({ childId, error: planResult.error.message }, 'child plan failed');
    }
  }
}

/**
 * Core orchestration loop. Runs Claude iterations until done.
 *
 * No globals — all state passed as arguments.
 * Handles: state transitions, overflow (split/escalate), plan/build completion,
 * max iterations, test validation.
 */
export function runLoop(
  issueId: string,
  mode: LoopMode,
  config: Config,
  provider: IssueProvider,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<void> => {
      const lockResult = await provider.lockIssue(issueId);
      if (lockResult.isErr()) throw lockResult.error;

      try {
        let model = mode === 'plan' ? config.planModel : config.buildModel;
        let iteration = 0;
        let splitPending = false;

        // Build mode: transition to IN_PROGRESS on first iteration
        if (mode === 'build') {
          const issueResult = await provider.fetchIssue(issueId);
          if (issueResult.isOk()) {
            const s = issueResult.value.state;
            if (s === 'NEW' || s === 'PLANNED') {
              const t = await provider.transition(issueId, 'IN_PROGRESS');
              if (t.isErr()) logger.warn({ error: t.error.message }, 'transition failed');
            }
          }
        }

        iterationLoop: while (shouldContinue(iteration, config)) {
          const issueResult = await provider.fetchIssue(issueId);
          if (issueResult.isErr()) throw issueResult.error;
          if (issueResult.value.state === 'COMPLETED') break;

          const currentMode: LoopMode = splitPending ? 'split' : mode;
          logger.info({ issueId, mode: currentMode, model, iteration }, 'starting iteration');

          const prompt = injectPromptVars(PROMPT_TEMPLATES[currentMode], {
            issueId,
            issueFile: resolveIssueFile(issueId, config),
            mode: currentMode,
            iteration,
            issuesDir: config.issuesDir,
            planDir:   config.planDir,
          });

          const iterResult = await runClaudeIteration(prompt, model, config);
          if (iterResult.isErr()) throw iterResult.error;
          const { outcome, tokens } = iterResult.value;

          logger.info({ issueId, iteration, outcome, tokens }, 'iteration complete');

          // ── Split iteration completed ──────────────────────────────────────
          if (splitPending) {
            splitPending = false;
            const reloaded = await provider.fetchIssue(issueId);
            if (reloaded.isOk() && reloaded.value.state !== 'SPLIT') {
              await provider.transition(issueId, 'SPLIT');
            }
            const fresh = await provider.fetchIssue(issueId);
            if (fresh.isOk() && fresh.value.children.length > 0) {
              await provider.unlockIssue(issueId);
              await planSplitChildren(fresh.value.children, config, provider);
              return;
            }
            break iterationLoop;
          }

          // ── Handle iteration outcome ───────────────────────────────────────
          if (outcome === 'overflow') {
            const fresh = await provider.fetchIssue(issueId);
            if (fresh.isErr()) throw fresh.error;
            const decision = handleOverflow(fresh.value.split_count, config);
            if (decision.action === 'split') {
              splitPending = true;
              model = decision.nextModel;
              await provider.writeIssue(issueId, {
                split_count: fresh.value.split_count + 1,
              });
            } else {
              model = decision.nextModel;
              logger.info({ newModel: model }, 'escalating to extended context model');
            }
            continue iterationLoop;
          }

          if (outcome === 'rate_limited') {
            const resetsAt = iterResult.value.rateLimitResetsAt;
            const timeStr = resetsAt
              ? new Date(resetsAt * 1000).toLocaleTimeString()
              : 'soon';
            throw new Error(`Rate limited until ${timeStr}`);
          }

          if (outcome === 'error') {
            logger.warn({ issueId, iteration }, 'claude returned error — stopping loop');
            break iterationLoop;
          }

          // ── Normal success — check completion ──────────────────────────────

          // Plan mode: single iteration, then check for plan file
          if (mode === 'plan') {
            const planFile = join(config.planDir, `${issueId}.md`);
            if (existsSync(planFile)) {
              const fresh = await provider.fetchIssue(issueId);
              if (fresh.isOk() && fresh.value.state !== 'PLANNED') {
                await provider.transition(issueId, 'PLANNED');
              }
            }
            break iterationLoop; // plan mode is always single iteration
          }

          // Build mode: check acceptance criteria + optional test command
          if (mode === 'build') {
            const criteriaResult = await provider.checkAcceptanceCriteria(issueId);
            const criteriaMet = criteriaResult.isOk() && criteriaResult.value;

            if (criteriaMet) {
              let testsPassed = true;
              if (config.testCommand) {
                const testResult = await execFileNoThrow('sh', ['-c', config.testCommand]);
                testsPassed = testResult.status === 0;
                if (!testsPassed) {
                  logger.warn({ issueId, iteration }, 'tests failed — continuing');
                }
              }
              if (testsPassed) {
                const fresh = await provider.fetchIssue(issueId);
                if (fresh.isOk() && fresh.value.state !== 'COMPLETED') {
                  await provider.transition(issueId, 'COMPLETED');
                }
                break iterationLoop;
              }
            }
          }

          iteration++;
        }
      } finally {
        await provider.unlockIssue(issueId);
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e))),
  );
}
