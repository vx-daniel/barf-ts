# Execution Engine + Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `context.ts` (async stream parser), `claude.ts` (subprocess wrapper), `batch.ts` (orchestration loop), and the `plan`/`build` CLI commands — making barf actually run Claude agent sessions end-to-end.

**Architecture:** `runLoop(issueId, mode, config, provider)` in `batch.ts` is the orchestration core. It calls `runClaudeIteration` (in `claude.ts`) which spawns the `claude` CLI and pipes stdout through `parseClaudeStream` (in `context.ts`). All state is passed as function arguments — no globals (the bash `ISSUE_ID`/`MODE` mutation bugs are impossible by construction). Overflow handling decides split vs. escalate based on `issue.split_count` vs. `config.maxAutoSplits`.

**Tech Stack:** Bun, TypeScript strict, neverthrow `ResultAsync`, Zod 4, Pino — same as plan 02. Prompt templates bundled as static text via Bun import attributes (`with { type: 'text' }`).

**Prerequisites:** Plans `02-issue-provider-plugin-system` and `03-oxc-linter-formatter` complete. `src/`, `tests/`, `package.json`, git all exist.

**Out of scope:** `barf-hook-precommit`, `barf-hook-stop` (plan 02 v2.1 hooks), MCP server (v3.0), `ora` spinner animations (add in follow-up), rate-limit retry logic, `--dry-run` mode.

**Relevant skills and agents for the implementer:**

| Task | Skills / Agents to invoke |
|------|--------------------------|
| Task 1 — prompt templates | **Agent:** `prompt-engineer` (expert in LLM prompt design — use to review/improve the PROMPT_*.md files for clarity and effectiveness) |
| Task 2 — context.ts | **Skills:** `javascript-typescript:modern-javascript-patterns` (async generators, `for await`), `javascript-typescript:javascript-testing-patterns` (testing async iterators with mock streams), `zod-schema` (Zod 4 patterns if stream event schemas are added) |
| Task 3 — claude.ts | **Skills:** `javascript-typescript:nodejs-backend-patterns` (subprocess spawning, stdio pipes), `everything-claude-code:security-review` (user-controlled args into subprocess — verify no injection); **Agent:** `typescript-pro` (for ResultAsync + async generator type safety) |
| Task 4 — batch.ts | **Skills:** `superpowers:test-driven-development`, `javascript-typescript:javascript-testing-patterns` (mocking `runClaudeIteration`); **Agent:** `typescript-pro` (labeled loops, discriminated unions) |
| Tasks 5-7 — CLI commands | **Agent:** `cli-developer` (expert in commander patterns, arg parsing, UX conventions) |
| Task 8 — verification | **Skill:** `superpowers:verification-before-completion` (mandatory before claiming done) |
| Any async stream bug | **Skill:** `superpowers:systematic-debugging`; **Agent:** `error-detective` (chunk-boundary and backpressure bugs are subtle) |

**Note on `typescript-lsp` plugin:** Installed. After writing each file, run `bun tsc --noEmit` — errors surface inline in the editor via the LSP too.

---

### Task 1: Prompt templates + asset type declaration

**Files:**
- Create: `src/types/assets.d.ts`
- Create: `src/prompts/PROMPT_plan.md`
- Create: `src/prompts/PROMPT_build.md`
- Create: `src/prompts/PROMPT_split.md`

**Step 1: Create TypeScript declaration for .md text imports**

```typescript
// src/types/assets.d.ts
declare module '*.md' {
  const content: string;
  export default content;
}
```

**Step 2: Create PROMPT_plan.md**

```markdown
# Planning Phase — Issue $BARF_ISSUE_ID

You are planning issue **$BARF_ISSUE_ID**.

## Context

- Study the issue file: `$BARF_ISSUE_FILE`
- Study existing plan (if any): `$PLAN_DIR/$BARF_ISSUE_ID.md`
- Read `AGENTS.md` for build/test commands and codebase conventions

## Phase 1: Understand

1. Read the issue file thoroughly — requirements, acceptance criteria, technical notes
2. Explore the codebase for relevant patterns (launch Explore subagents in parallel)
3. Identify what already exists vs. what needs building (gap analysis)

## Phase 2: Plan

1. Document key design decisions and rationale
2. Map each acceptance criterion to a required test
3. Write the implementation plan: bite-sized TDD steps with exact file paths and commands

## Save Plan

Save the completed plan to: `$PLAN_DIR/$BARF_ISSUE_ID.md`

> barf detects this file automatically and transitions the issue NEW → PLANNED.
> You do not need to update the issue state manually.
```

**Step 3: Create PROMPT_build.md**

```markdown
# Build Phase — Issue $BARF_ISSUE_ID (Iteration $BARF_ITERATION)

You are implementing issue **$BARF_ISSUE_ID**.

## Context

- Issue file: `$BARF_ISSUE_FILE`
- Implementation plan: `$PLAN_DIR/$BARF_ISSUE_ID.md`
- Read `AGENTS.md` for build/test commands and patterns

## Instructions

1. Follow the implementation plan exactly
2. Write failing tests first (TDD), then implement the minimal code to pass
3. Ensure all acceptance criteria checkboxes are checked `[x]` before finishing
4. Run tests and confirm they pass

## Completion

When all acceptance criteria are met and tests pass:

1. Update the issue file: change `state=PLANNED` to `state=BUILT` in the frontmatter
2. Commit your work with a clear message
```

**Step 4: Create PROMPT_split.md**

```markdown
# Split Phase — Issue $BARF_ISSUE_ID

The context window is nearly full. Split issue **$BARF_ISSUE_ID** into smaller child issues.

## Context

- Issue file: `$BARF_ISSUE_FILE`
- Implementation plan: `$PLAN_DIR/$BARF_ISSUE_ID.md`

## Instructions

1. Review the original issue and identify logical sub-tasks that can be completed independently
2. Create child issue files in `$ISSUES_DIR/`:
   - Names: `$BARF_ISSUE_ID-1.md`, `$BARF_ISSUE_ID-2.md`, etc.
   - Each child must have complete frontmatter:
     ```
     ---
     id=$BARF_ISSUE_ID-1
     title=<descriptive title>
     state=NEW
     parent=$BARF_ISSUE_ID
     children=
     split_count=0
     ---
     ```
3. Update the parent issue:
   - Set `children=$BARF_ISSUE_ID-1,$BARF_ISSUE_ID-2,...`
   - Set `state=SPLIT`
4. Commit all changes
```

**Step 5: Verify TypeScript compiles**

Run: `bun tsc --noEmit`
Expected: No errors (assets.d.ts adds .md module declarations)

**Step 6: Commit**

```bash
git add src/types/assets.d.ts src/prompts/
git commit -m "feat: prompt templates and .md type declaration — plan, build, split with BARF_* variables"
```

---

### Task 2: context.ts — async stream parser and prompt variable injection

**Files:**
- Create: `tests/unit/context.test.ts`
- Create: `src/core/context.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/context.test.ts
import { describe, it, expect, mock } from 'bun:test';
import {
  parseClaudeStream,
  injectPromptVars,
  ContextOverflowError,
  RateLimitError,
} from '../../src/core/context';

// Helper: create a mock subprocess with controlled stdout lines
function makeProc(lines: string[]): {
  stdout: ReadableStream<Uint8Array>;
  kill: ReturnType<typeof mock>;
} {
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line + '\n'));
      controller.close();
    },
  });
  return { stdout: readable, kill: mock(() => {}) };
}

// Sample stream-json lines
const MAIN_USAGE = JSON.stringify({
  parent_tool_use_id: null,
  message: { usage: { cache_creation_input_tokens: 1000, cache_read_input_tokens: 500 } },
});

const SUB_USAGE = JSON.stringify({
  parent_tool_use_id: 'some-tool-id',
  message: { usage: { cache_creation_input_tokens: 9999, cache_read_input_tokens: 0 } },
});

const TOOL_LINE = JSON.stringify({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name: 'Read' }, { type: 'text', text: 'hi' }] },
});

const RATE_LIMIT = JSON.stringify({
  type: 'rate_limit_event',
  rate_limit_info: { status: 'rejected', resetsAt: 1_700_000_000 },
});

describe('parseClaudeStream', () => {
  it('yields usage events from main context (parent_tool_use_id=null)', async () => {
    const proc = makeProc([MAIN_USAGE]);
    const events = [];
    for await (const event of parseClaudeStream(proc, 100_000)) events.push(event);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'usage', tokens: 1500 });
  });

  it('ignores usage from sub-agent context (parent_tool_use_id != null)', async () => {
    const proc = makeProc([SUB_USAGE]);
    const events = [];
    for await (const event of parseClaudeStream(proc, 100_000)) events.push(event);
    expect(events).toHaveLength(0);
  });

  it('yields tool events from assistant messages', async () => {
    const proc = makeProc([TOOL_LINE]);
    const events = [];
    for await (const event of parseClaudeStream(proc, 100_000)) events.push(event);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'tool', name: 'Read' });
  });

  it('kills proc and throws ContextOverflowError when threshold exceeded', async () => {
    const proc = makeProc([MAIN_USAGE]); // 1500 tokens
    let threw: unknown;
    try {
      for await (const _ of parseClaudeStream(proc, 1000)) { /* consume */ }
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(ContextOverflowError);
    expect((threw as ContextOverflowError).tokens).toBe(1500);
    expect(proc.kill).toHaveBeenCalled();
  });

  it('throws RateLimitError on rate_limit_event with status=rejected', async () => {
    const proc = makeProc([RATE_LIMIT]);
    let threw: unknown;
    try {
      for await (const _ of parseClaudeStream(proc, 100_000)) { /* consume */ }
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(RateLimitError);
    expect(proc.kill).toHaveBeenCalled();
  });

  it('skips non-JSON lines without throwing', async () => {
    const proc = makeProc(['not json at all', MAIN_USAGE, 'also bad']);
    const events = [];
    for await (const event of parseClaudeStream(proc, 100_000)) events.push(event);
    expect(events).toHaveLength(1);
  });

  it('does not yield duplicate usage for same token count', async () => {
    const proc = makeProc([MAIN_USAGE, MAIN_USAGE]); // same count twice
    const events = [];
    for await (const event of parseClaudeStream(proc, 100_000)) events.push(event);
    expect(events).toHaveLength(1); // second is ignored (not > maxTokens)
  });
});

describe('injectPromptVars', () => {
  const vars = {
    issueId: '001',
    issueFile: 'issues/001.md.working',
    mode: 'build',
    iteration: 2,
    issuesDir: 'issues',
    planDir: 'plans',
  };

  it('replaces $BARF_ISSUE_ID', () => {
    expect(injectPromptVars('id: $BARF_ISSUE_ID', vars)).toBe('id: 001');
  });

  it('replaces ${BARF_ISSUE_ID} (braced form)', () => {
    expect(injectPromptVars('id: ${BARF_ISSUE_ID}', vars)).toBe('id: 001');
  });

  it('replaces all six variables', () => {
    const t = '$BARF_ISSUE_ID $BARF_ISSUE_FILE $BARF_MODE $BARF_ITERATION $ISSUES_DIR $PLAN_DIR';
    expect(injectPromptVars(t, vars)).toBe('001 issues/001.md.working build 2 issues plans');
  });

  it('replaces multiple occurrences of the same variable', () => {
    expect(injectPromptVars('$BARF_ISSUE_ID $BARF_ISSUE_ID', vars)).toBe('001 001');
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/context.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**

```typescript
// src/core/context.ts
import type { ClaudeEvent } from '../types/index.js';

export class ContextOverflowError extends Error {
  constructor(public readonly tokens: number) {
    super(`Context threshold exceeded: ${tokens} tokens`);
    this.name = 'ContextOverflowError';
  }
}

export class RateLimitError extends Error {
  constructor(public readonly resetsAt?: number) {
    const resetStr = resetsAt
      ? new Date(resetsAt * 1000).toLocaleTimeString()
      : 'soon';
    super(`Rate limited until ${resetStr}`);
    this.name = 'RateLimitError';
  }
}

/**
 * Async generator that parses Claude's --output-format stream-json stdout.
 * Yields ClaudeEvent (usage | tool). Kills proc and throws on overflow or rate limit.
 *
 * Token tracking: only from main context (parent_tool_use_id === null).
 * Sub-agent tokens are ignored to prevent premature interruption during tool calls.
 */
export async function* parseClaudeStream(
  proc: { stdout: ReadableStream<Uint8Array>; kill: (signal?: string) => void },
  threshold: number,
): AsyncGenerator<ClaudeEvent> {
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let maxTokens = 0;

  try {
    loop: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process all complete lines (up to last newline)
      const nl = buffer.lastIndexOf('\n');
      if (nl === -1) continue;
      const lines = buffer.slice(0, nl + 1).split('\n');
      buffer = buffer.slice(nl + 1);

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          continue; // skip non-JSON lines (e.g. stderr mixed in)
        }

        // Rate limit detection
        if (obj['type'] === 'rate_limit_event') {
          const info = obj['rate_limit_info'] as
            | { status?: string; resetsAt?: number }
            | undefined;
          if (info?.status === 'rejected') {
            proc.kill();
            throw new RateLimitError(info.resetsAt);
          }
        }

        // Token usage — main context only (parent_tool_use_id must be null)
        if (obj['parent_tool_use_id'] === null && obj['message']) {
          const msg = obj['message'] as {
            usage?: {
              cache_creation_input_tokens?: number;
              cache_read_input_tokens?: number;
            };
          };
          if (msg.usage) {
            const tokens =
              (msg.usage.cache_creation_input_tokens ?? 0) +
              (msg.usage.cache_read_input_tokens ?? 0);
            if (tokens > maxTokens) {
              maxTokens = tokens;
              yield { type: 'usage', tokens };
              if (tokens >= threshold) {
                proc.kill('SIGTERM');
                throw new ContextOverflowError(tokens);
              }
            }
          }
        }

        // Tool name from assistant messages
        if (obj['type'] === 'assistant' && obj['message']) {
          const msg = obj['message'] as {
            content?: Array<{ type: string; name?: string }>;
          };
          const tool = msg.content?.find((c) => c.type === 'tool_use' && c.name);
          if (tool?.name) yield { type: 'tool', name: tool.name };
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch { /* ignore double-release */ }
  }
}

/**
 * Injects barf template variables into a prompt string.
 * Simple string replacement — no eval, no shell, injection-safe.
 */
export function injectPromptVars(
  template: string,
  vars: {
    issueId: string;
    issueFile: string;
    mode: string;
    iteration: number;
    issuesDir: string;
    planDir: string;
  },
): string {
  return template
    .replace(/\$\{?BARF_ISSUE_ID\}?/g, vars.issueId)
    .replace(/\$\{?BARF_ISSUE_FILE\}?/g, vars.issueFile)
    .replace(/\$\{?BARF_MODE\}?/g, vars.mode)
    .replace(/\$\{?BARF_ITERATION\}?/g, String(vars.iteration))
    .replace(/\$\{?ISSUES_DIR\}?/g, vars.issuesDir)
    .replace(/\$\{?PLAN_DIR\}?/g, vars.planDir);
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/context.test.ts`
Expected: All 10 tests pass

**Step 5: Commit**

```bash
git add src/core/context.ts tests/unit/context.test.ts
git commit -m "feat: context.ts — parseClaudeStream, injectPromptVars, ContextOverflowError, RateLimitError"
```

---

### Task 3: claude.ts — Claude subprocess wrapper

**Files:**
- Create: `tests/unit/claude.test.ts`
- Create: `src/core/claude.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/claude.test.ts
import { describe, it, expect } from 'bun:test';
import { getThreshold } from '../../src/core/claude';

// runClaudeIteration spawns a real subprocess — tested in tests/integration/
// getThreshold is the only pure function to unit test here.

describe('getThreshold', () => {
  it('computes 75% of 200000 = 150000 for sonnet', () => {
    expect(getThreshold('claude-sonnet-4-6', 75)).toBe(150_000);
  });

  it('computes 50% of 200000 = 100000 for opus', () => {
    expect(getThreshold('claude-opus-4-6', 50)).toBe(100_000);
  });

  it('uses 200000 as default limit for unknown models', () => {
    expect(getThreshold('unknown-model-xyz', 80)).toBe(160_000);
  });

  it('handles 100% threshold', () => {
    expect(getThreshold('claude-sonnet-4-6', 100)).toBe(200_000);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/claude.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**

```typescript
// src/core/claude.ts
import { spawn } from 'bun';
import { ResultAsync } from 'neverthrow';
import type { Config } from '../types/index.js';
import { parseClaudeStream, ContextOverflowError, RateLimitError } from './context.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('claude');

export type IterationOutcome = 'success' | 'overflow' | 'error' | 'rate_limited';

export interface IterationResult {
  outcome: IterationOutcome;
  tokens: number;
  rateLimitResetsAt?: number;
}

// Context window limits per model (tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-opus-4-6':           200_000,
  'claude-sonnet-4-6':         200_000,
  'claude-haiku-4-5-20251001': 200_000,
};

/**
 * Computes the token threshold at which barf interrupts a Claude session.
 * threshold = floor(contextUsagePercent% × modelLimit)
 */
export function getThreshold(model: string, contextUsagePercent: number): number {
  const limit = MODEL_CONTEXT_LIMITS[model] ?? 200_000;
  return Math.floor((contextUsagePercent / 100) * limit);
}

/**
 * Spawns the `claude` CLI and runs a single agent iteration.
 * Prompt is passed via stdin. Returns ResultAsync — never throws.
 *
 * Key env overrides:
 *   CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=100  disables Claude Code auto-compact so
 *   barf can track context and interrupt at the configured threshold itself.
 */
export function runClaudeIteration(
  prompt: string,
  model: string,
  config: Config,
): ResultAsync<IterationResult, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<IterationResult> => {
      const threshold = getThreshold(model, config.contextUsagePercent);
      let timedOut = false;

      const proc = spawn({
        cmd: [
          'claude', '-p',
          '--dangerously-skip-permissions',
          '--output-format', 'stream-json',
          '--model', model,
        ],
        stdin: Buffer.from(prompt),
        stdout: 'pipe',
        stderr: 'inherit',
        env: { ...process.env, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '100' },
      });

      const timeoutHandle =
        config.claudeTimeout > 0
          ? setTimeout(() => {
              timedOut = true;
              proc.kill('SIGTERM');
            }, config.claudeTimeout * 1000)
          : null;

      let lastTokens = 0;
      try {
        for await (const event of parseClaudeStream(proc, threshold)) {
          if (event.type === 'usage') {
            lastTokens = event.tokens;
            logger.debug({ tokens: event.tokens }, 'context update');
          } else if (event.type === 'tool') {
            logger.debug({ tool: event.name }, 'tool call');
          }
        }
        await proc.exited;
        if (timedOut) {
          logger.warn({ model, timeout: config.claudeTimeout }, 'claude timed out');
          return { outcome: 'error', tokens: lastTokens };
        }
        return { outcome: 'success', tokens: lastTokens };
      } catch (e) {
        if (e instanceof ContextOverflowError)
          return { outcome: 'overflow', tokens: e.tokens };
        if (e instanceof RateLimitError)
          return {
            outcome: 'rate_limited',
            tokens: lastTokens,
            rateLimitResetsAt: e.resetsAt,
          };
        throw e;
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e))),
  );
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/claude.test.ts`
Expected: 4 tests pass

**Step 5: TypeScript check**

Run: `bun tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/core/claude.ts tests/unit/claude.test.ts
git commit -m "feat: claude.ts — runClaudeIteration, getThreshold, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=100"
```

---

### Task 4: batch.ts — execution engine

**Files:**
- Create: `tests/unit/batch.test.ts`
- Create: `src/core/batch.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/batch.test.ts
import { describe, it, expect } from 'bun:test';
import { shouldContinue, handleOverflow } from '../../src/core/batch';
import { ConfigSchema } from '../../src/types/index';
import type { Config } from '../../src/types/index';

const defaultConfig = (): Config => ConfigSchema.parse({});

describe('shouldContinue', () => {
  it('returns true when maxIterations=0 (unlimited)', () => {
    expect(shouldContinue(999, defaultConfig())).toBe(true);
  });

  it('returns false when iteration >= maxIterations', () => {
    const config = { ...defaultConfig(), maxIterations: 3 };
    expect(shouldContinue(3, config)).toBe(false);
  });

  it('returns true when iteration < maxIterations', () => {
    const config = { ...defaultConfig(), maxIterations: 3 };
    expect(shouldContinue(2, config)).toBe(true);
  });
});

describe('handleOverflow', () => {
  it('returns split when split_count < maxAutoSplits', () => {
    const result = handleOverflow(0, defaultConfig()); // default maxAutoSplits=3
    expect(result.action).toBe('split');
    expect(result.nextModel).toBe(defaultConfig().splitModel);
  });

  it('returns escalate when split_count >= maxAutoSplits', () => {
    const config = { ...defaultConfig(), maxAutoSplits: 3 };
    const result = handleOverflow(3, config);
    expect(result.action).toBe('escalate');
    expect(result.nextModel).toBe(config.extendedContextModel);
  });

  it('uses splitModel from config for split decision', () => {
    const config = { ...defaultConfig(), splitModel: 'claude-sonnet-4-6' };
    expect(handleOverflow(0, config).nextModel).toBe('claude-sonnet-4-6');
  });

  it('uses extendedContextModel from config for escalate decision', () => {
    const config = {
      ...defaultConfig(),
      maxAutoSplits: 1,
      extendedContextModel: 'claude-opus-4-6',
    };
    expect(handleOverflow(1, config).nextModel).toBe('claude-opus-4-6');
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/batch.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**

```typescript
// src/core/batch.ts
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
  return `${issueId}`; // GitHub fallback — prompt receives issue ID only
}

/**
 * Plans each NEW child issue sequentially after a split.
 * Equivalent to bash loop_plan_split_children — no global state mutations.
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
    // Recursive: plan each child. Errors are logged but don't stop siblings.
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
      // Lock issue for exclusive access
      const lockResult = await provider.lockIssue(issueId);
      if (lockResult.isErr()) throw lockResult.error;

      try {
        let model = mode === 'plan' ? config.planModel : config.buildModel;
        let iteration = 0;
        let splitPending = false;

        // Build mode: transition to PLANNED on first iteration
        if (mode === 'build') {
          const issueResult = await provider.fetchIssue(issueId);
          if (issueResult.isOk()) {
            const s = issueResult.value.state;
            if (s === 'NEW' || s === 'PLANNED') {
              const t = await provider.transition(issueId, 'PLANNED');
              if (t.isErr()) logger.warn({ error: t.error.message }, 'transition failed');
            }
          }
        }

        iterationLoop: while (shouldContinue(iteration, config)) {
          const issueResult = await provider.fetchIssue(issueId);
          if (issueResult.isErr()) throw issueResult.error;
          if (issueResult.value.state === 'BUILT') break;

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

          // ── Split iteration completed ────────────────────────────────────────
          if (splitPending) {
            splitPending = false;
            const reloaded = await provider.fetchIssue(issueId);
            if (reloaded.isOk() && reloaded.value.state !== 'SPLIT') {
              await provider.transition(issueId, 'SPLIT');
            }
            const fresh = await provider.fetchIssue(issueId);
            if (fresh.isOk() && fresh.value.children.length > 0) {
              // Unlock before planning children (they need their own locks)
              await provider.unlockIssue(issueId);
              await planSplitChildren(fresh.value.children, config, provider);
              return; // parent loop ends after split
            }
            break iterationLoop;
          }

          // ── Handle iteration outcome ─────────────────────────────────────────
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
            continue iterationLoop; // retry, don't increment iteration
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

          // ── Normal success — check completion ────────────────────────────────

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
                if (fresh.isOk() && fresh.value.state !== 'BUILT') {
                  await provider.transition(issueId, 'BUILT');
                }
                break iterationLoop;
              }
            }
          }

          iteration++;
        }
      } finally {
        // Always unlock, even on error
        await provider.unlockIssue(issueId);
      }
    })(),
    (e) => (e instanceof Error ? e : new Error(String(e))),
  );
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/batch.test.ts`
Expected: All 7 tests pass

**Step 5: TypeScript check**

Run: `bun tsc --noEmit`
Expected: No errors (if `.md` imports show errors, verify `src/types/assets.d.ts` is in `tsconfig.json` `include`)

**Step 6: Commit**

```bash
git add src/core/batch.ts tests/unit/batch.test.ts
git commit -m "feat: batch.ts — runLoop, shouldContinue, handleOverflow, planSplitChildren (no global state)"
```

---

### Task 5: plan command

**Files:**
- Create: `src/cli/commands/plan.ts`

**Step 1: Implement**

```typescript
// src/cli/commands/plan.ts
import type { IssueProvider } from '../../core/issue-providers/base.js';
import type { Config } from '../../types/index.js';
import { runLoop } from '../../core/batch.js';

export async function planCommand(
  provider: IssueProvider,
  opts: { issue?: string },
  config: Config,
): Promise<void> {
  let issueId = opts.issue;

  if (!issueId) {
    const result = await provider.autoSelect('plan');
    if (result.isErr()) {
      console.error(`Error: ${result.error.message}`);
      process.exit(1);
    }
    if (!result.value) {
      console.log('No issues available for planning (no NEW issues found).');
      return;
    }
    issueId = result.value.id;
  }

  console.log(`Planning issue ${issueId}...`);
  const result = await runLoop(issueId, 'plan', config, provider);
  if (result.isErr()) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }
  console.log(`Issue ${issueId} planned.`);
}
```

**Step 2: Commit**

```bash
git add src/cli/commands/plan.ts
git commit -m "feat: plan command — auto-select NEW issue or explicit --issue, delegates to runLoop"
```

---

### Task 6: build command

**Files:**
- Create: `src/cli/commands/build.ts`

**Step 1: Implement**

```typescript
// src/cli/commands/build.ts
import type { IssueProvider } from '../../core/issue-providers/base.js';
import type { Config } from '../../types/index.js';
import { runLoop } from '../../core/batch.js';

export async function buildCommand(
  provider: IssueProvider,
  opts: { issue?: string; batch: number; max: number },
  config: Config,
): Promise<void> {
  // --max overrides config.maxIterations for this invocation only
  const effectiveConfig =
    opts.max > 0 ? { ...config, maxIterations: opts.max } : config;

  if (opts.issue) {
    console.log(`Building issue ${opts.issue}...`);
    const result = await runLoop(opts.issue, 'build', effectiveConfig, provider);
    if (result.isErr()) {
      console.error(`Error: ${result.error.message}`);
      process.exit(1);
    }
    console.log(`Issue ${opts.issue} build complete.`);
    return;
  }

  // Batch mode: pick up to opts.batch issues in priority order
  const listResult = await provider.listIssues();
  if (listResult.isErr()) {
    console.error(`Error: ${listResult.error.message}`);
    process.exit(1);
  }

  const BUILDABLE = new Set<string>(['PLANNED', 'PLANNED', 'NEW']);
  const candidates = listResult.value
    .filter((i) => BUILDABLE.has(i.state))
    .slice(0, opts.batch);

  if (candidates.length === 0) {
    console.log('No issues available for building.');
    return;
  }

  console.log(`Building ${candidates.length} issue(s) concurrently...`);

  const results = await Promise.allSettled(
    candidates.map((issue) => runLoop(issue.id, 'build', effectiveConfig, provider)),
  );

  let failures = 0;
  for (const [i, r] of results.entries()) {
    const id = candidates[i].id;
    if (r.status === 'rejected') {
      console.error(`  ✗ ${id}: ${r.reason}`);
      failures++;
    } else if (r.value.isErr()) {
      console.error(`  ✗ ${id}: ${r.value.error.message}`);
      failures++;
    } else {
      console.log(`  ✓ ${id}`);
    }
  }

  if (failures > 0) process.exit(1);
}
```

**Step 2: Commit**

```bash
git add src/cli/commands/build.ts
git commit -m "feat: build command — single issue or --batch concurrency, --max iterations override"
```

---

### Task 7: Wire plan + build into CLI entry point

**Files:**
- Modify: `src/index.ts`

**Step 1: Add imports to src/index.ts**

Add after the existing imports:

```typescript
import { planCommand } from './cli/commands/plan.js';
import { buildCommand } from './cli/commands/build.js';
```

**Step 2: Add plan and build commands**

Add after the `status` command registration in `src/index.ts`:

```typescript
program
  .command('plan')
  .description('Plan an issue with Claude AI (NEW → PLANNED)')
  .option('--issue <id>', 'Issue ID to plan (auto-selects NEW issue if omitted)')
  .action(async (opts) => {
    const config = loadConfig();
    const provider = getProvider(config);
    await planCommand(provider, { issue: opts.issue }, config);
  });

program
  .command('build')
  .description('Build an issue with Claude AI (PLANNED → BUILT)')
  .option('--issue <id>', 'Issue ID to build (auto-selects if omitted)')
  .option('--batch <n>', 'Number of issues to build concurrently', parseInt)
  .option('--max <n>', 'Max iterations per issue (0 = unlimited)', parseInt)
  .action(async (opts) => {
    const config = loadConfig();
    const provider = getProvider(config);
    await buildCommand(
      provider,
      { issue: opts.issue, batch: opts.batch ?? 1, max: opts.max ?? 0 },
      config,
    );
  });
```

**Step 3: TypeScript check**

Run: `bun tsc --noEmit`
Expected: No errors

**Step 4: Build and smoke test**

```bash
bun build --compile --outfile=dist/barf src/index.ts
./dist/barf --help
./dist/barf plan --help
./dist/barf build --help
```

Expected: All four commands (`init`, `status`, `plan`, `build`) appear in help output

**Step 5: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire plan + build commands into CLI — barf plan, barf build --batch=N --max=N"
```

---

### Task 8: Final verification

**Step 1: Full test suite with coverage**

Run: `bun test --coverage`
Expected: All tests pass; core modules (`context.ts`, `claude.ts`, `batch.ts`, `issue.ts`, `config.ts`, providers) at >80% coverage

**Step 2: TypeScript strict check**

Run: `bun tsc --noEmit`
Expected: Zero errors

**Step 3: Build binary**

Run: `bun build --compile --outfile=dist/barf src/index.ts`
Expected: `dist/barf` binary created, no bundler errors

**Step 4: Lint + format check**

Run: `bun run check`
Expected: Zero violations

**Step 5: Local smoke test**

```bash
mkdir -p /tmp/barf-smoke-04 && cd /tmp/barf-smoke-04
/path/to/dist/barf init
/path/to/dist/barf status          # → No issues found.
/path/to/dist/barf plan --help
/path/to/dist/barf build --help
```

Expected: `init` creates `issues/` and `plans/` directories; all commands respond without errors

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: plan 04 verified — execution engine + plan/build commands all green"
```

---

## What's next (plan 05)

- `barf-hook-precommit` — PreToolUse/Bash hook that runs tests and blocks commits if failing
- `barf-hook-stop` — Stop hook that reads `.barf/session_result.json` and transitions issue state
- `barf init` installs both hooks into `.claude/settings.json`
- `doctor` command — checks claude CLI, gh auth, .barfrc validity, provider connectivity

**Key skill for plan 05:** `.claude/skills/hook-development/SKILL.md` — project-local skill covering PreToolUse/Stop hook API, `${CLAUDE_PLUGIN_ROOT}`, prompt-based hooks, and event-driven automation. Use this first when implementing `barf-hook-precommit` and `barf-hook-stop`.
