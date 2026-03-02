# Pre-Complete Fix & Test Gate — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a pre-completion phase that runs configurable fix commands (best-effort) and a test gate (hard requirement) before transitioning issues to BUILT.

**Architecture:** New `src/core/pre-complete.ts` module mirrors `verification.ts` structure. Batch.ts delegates to it instead of inline testCommand logic. New `fixCommands` config field parsed from `.barfrc`.

**Tech Stack:** TypeScript, Zod 4, neverthrow, bun:test

---

### Task 1: Add `fixCommands` to Config

**Files:**
- Modify: `src/types/index.ts:146-180` (ConfigSchema)
- Modify: `src/core/config.ts:8-37` (KEY_MAP)
- Test: `tests/unit/config.test.ts` (if exists, add case)

**Step 1: Write the failing test**

Add to config tests (or create inline test):

```typescript
it('parses FIX_COMMANDS from .barfrc', () => {
  const result = parseBarfrc('FIX_COMMANDS=biome check --apply,bun run lint --fix')
  expect(result.isOk()).toBe(true)
  expect(result._unsafeUnwrap().fixCommands).toEqual([
    'biome check --apply',
    'bun run lint --fix',
  ])
})

it('defaults fixCommands to empty array', () => {
  const result = parseBarfrc('')
  expect(result.isOk()).toBe(true)
  expect(result._unsafeUnwrap().fixCommands).toEqual([])
})
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/unit/config.test.ts -t "FIX_COMMANDS"`
Expected: FAIL — `fixCommands` not in schema

**Step 3: Add fixCommands to ConfigSchema**

In `src/types/index.ts`, add to `ConfigSchema`:

```typescript
fixCommands: z.array(z.string()).default([]),
```

**Step 4: Add KEY_MAP entry and coercion in config.ts**

In `src/core/config.ts` KEY_MAP, add:

```typescript
FIX_COMMANDS: 'fixCommands',
```

In `RawConfigSchema`, override `fixCommands` to handle comma-separated string:

```typescript
fixCommands: z
  .preprocess(
    (v) => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : v ?? []),
    z.array(z.string()),
  )
  .default([]),
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/unit/config.test.ts -t "FIX_COMMANDS"`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types/index.ts src/core/config.ts tests/unit/config.test.ts
git commit -m "feat: add fixCommands config for pre-completion fix steps"
```

---

### Task 2: Create `pre-complete.ts` module — types and `runPreComplete`

**Files:**
- Create: `src/core/pre-complete.ts`
- Test: `tests/unit/pre-complete.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/pre-complete.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { runPreComplete } from '@/core/pre-complete'
import type { ExecResult } from '@/utils/execFileNoThrow'
import type { FixStep } from '@/core/pre-complete'

function mockExec(results: Record<string, ExecResult>) {
  return async (_file: string, args: string[] = []): Promise<ExecResult> => {
    const cmd = args.join(' ')
    for (const [pattern, result] of Object.entries(results)) {
      if (cmd.includes(pattern)) return result
    }
    return { stdout: '', stderr: '', status: 0 }
  }
}

const ok: ExecResult = { stdout: '', stderr: '', status: 0 }
const fail: ExecResult = { stdout: 'error output', stderr: 'stderr', status: 1 }

describe('runPreComplete', () => {
  it('returns passed when no fix commands and no test command', async () => {
    const result = await runPreComplete([], undefined, mockExec({}))
    const outcome = result._unsafeUnwrap()
    expect(outcome.passed).toBe(true)
  })

  it('runs fix commands and returns passed when tests pass', async () => {
    const fixes: FixStep[] = [{ name: 'lint', command: 'biome check --apply' }]
    const exec = mockExec({ biome: ok, test: ok })
    const result = await runPreComplete(fixes, 'bun test', exec)
    expect(result._unsafeUnwrap().passed).toBe(true)
  })

  it('returns passed even when fix commands fail', async () => {
    const fixes: FixStep[] = [{ name: 'lint', command: 'biome check --apply' }]
    const exec = mockExec({ biome: fail })
    const result = await runPreComplete(fixes, undefined, exec)
    expect(result._unsafeUnwrap().passed).toBe(true)
  })

  it('returns failed when test command fails', async () => {
    const exec = mockExec({ test: fail })
    const result = await runPreComplete([], 'bun test', exec)
    const outcome = result._unsafeUnwrap()
    expect(outcome.passed).toBe(false)
    if (!outcome.passed) {
      expect(outcome.testFailure.exitCode).toBe(1)
    }
  })

  it('fix command failure does not block test from running', async () => {
    let testRan = false
    const exec = async (_file: string, args: string[] = []): Promise<ExecResult> => {
      const cmd = args.join(' ')
      if (cmd.includes('biome')) return fail
      if (cmd.includes('test')) {
        testRan = true
        return ok
      }
      return ok
    }
    const fixes: FixStep[] = [{ name: 'lint', command: 'biome check --apply' }]
    await runPreComplete(fixes, 'bun test', exec)
    expect(testRan).toBe(true)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/pre-complete.test.ts`
Expected: FAIL — module doesn't exist

**Step 3: Implement `pre-complete.ts`**

Create `src/core/pre-complete.ts`:

```typescript
import { ResultAsync } from 'neverthrow'
import type { ExecFn } from '@/core/verification'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'

const logger = createLogger('pre-complete')

/** A fix command to run before testing. */
export interface FixStep {
  name: string
  command: string
}

/** Outcome of the pre-completion checks. */
export type PreCompleteResult =
  | { passed: true }
  | { passed: false; testFailure: { stdout: string; stderr: string; exitCode: number } }

/**
 * Converts config `fixCommands` strings into {@link FixStep} entries.
 * Each command string becomes a named step (name derived from first word).
 *
 * @param commands - Raw command strings from config (e.g. `['biome check --apply']`).
 * @returns Array of {@link FixStep} ready for {@link runPreComplete}.
 */
export function toFixSteps(commands: string[]): FixStep[] {
  return commands.map((cmd) => ({
    name: cmd.split(' ')[0] ?? cmd,
    command: cmd,
  }))
}

/**
 * Runs pre-completion checks: fix commands (best-effort) then test gate (hard requirement).
 *
 * Fix commands run sequentially via `sh -c`. Failures are logged but do not block.
 * If `testCommand` is set, it must exit 0 for the result to be `{ passed: true }`.
 *
 * @param fixSteps - Fix commands to run (best-effort).
 * @param testCommand - Shell command that must pass; `undefined` or empty to skip.
 * @param execFn - Injectable subprocess executor.
 * @returns `ok({ passed: true })` or `ok({ passed: false, testFailure })`. Never errors.
 */
export function runPreComplete(
  fixSteps: FixStep[],
  testCommand: string | undefined,
  execFn: ExecFn = execFileNoThrow,
): ResultAsync<PreCompleteResult, never> {
  const run = async (): Promise<PreCompleteResult> => {
    // Run fix commands (best-effort)
    for (const step of fixSteps) {
      logger.debug({ step: step.name }, 'running fix step')
      const result = await execFn('sh', ['-c', step.command])
      if (result.status !== 0) {
        logger.warn(
          { step: step.name, exitCode: result.status },
          'fix step failed — continuing',
        )
      } else {
        logger.debug({ step: step.name }, 'fix step passed')
      }
    }

    // Run test gate
    if (testCommand) {
      logger.debug({ testCommand }, 'running test gate')
      const result = await execFn('sh', ['-c', testCommand])
      if (result.status !== 0) {
        logger.warn({ exitCode: result.status }, 'test gate failed')
        return {
          passed: false,
          testFailure: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.status,
          },
        }
      }
      logger.debug('test gate passed')
    }

    return { passed: true }
  }

  return ResultAsync.fromSafePromise(run())
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/unit/pre-complete.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add src/core/pre-complete.ts tests/unit/pre-complete.test.ts
git commit -m "feat: add pre-complete module with fix steps and test gate"
```

---

### Task 3: Integrate `runPreComplete` into `batch.ts`

**Files:**
- Modify: `src/core/batch.ts:24-27` (RunLoopDeps type)
- Modify: `src/core/batch.ts:354-386` (build completion block)
- Test: `tests/unit/batch-runloop.test.ts`

**Step 1: Update the failing batch tests**

Add/modify tests in `tests/unit/batch-runloop.test.ts`:

Add a `mockRunPreComplete` to the existing test setup:

```typescript
import { runPreComplete } from '@/core/pre-complete'

const mockRunPreComplete = () =>
  ResultAsync.fromSafePromise(Promise.resolve({ passed: true } as const))
```

Update `deps` to include it:

```typescript
const deps = {
  runClaudeIteration: mockRunClaudeIteration as never,
  verifyIssue: mockVerifyIssue as never,
  runPreComplete: mockRunPreComplete as never,
}
```

Add new test cases:

```typescript
it('runs pre-complete before BUILT transition', async () => {
  let preCompleteRan = false
  const customDeps = {
    ...deps,
    runPreComplete: () => {
      preCompleteRan = true
      return ResultAsync.fromSafePromise(Promise.resolve({ passed: true } as const))
    },
  }
  const provider = makeProvider({
    lockIssue: () => okAsync(undefined),
    unlockIssue: () => okAsync(undefined),
    fetchIssue: () => okAsync(makeIssue({ state: 'PLANNED' })),
    transition: () => okAsync(makeIssue({ state: 'BUILT' })),
    checkAcceptanceCriteria: () => okAsync(true),
    writeIssue: () => okAsync(makeIssue({ state: 'PLANNED' })),
  })

  await runLoop('001', 'build', defaultConfig(), provider, customDeps)
  expect(preCompleteRan).toBe(true)
})

it('continues loop when pre-complete test gate fails', async () => {
  const config = { ...defaultConfig(), maxIterations: 1, testCommand: 'bun test' }
  const customDeps = {
    ...deps,
    runPreComplete: () =>
      ResultAsync.fromSafePromise(
        Promise.resolve({
          passed: false,
          testFailure: { stdout: '', stderr: 'fail', exitCode: 1 },
        } as const),
      ),
  }
  let transitionTargets: string[] = []
  const provider = makeProvider({
    lockIssue: () => okAsync(undefined),
    unlockIssue: () => okAsync(undefined),
    fetchIssue: () => okAsync(makeIssue({ state: 'PLANNED' })),
    transition: (_id, to) => {
      transitionTargets.push(to)
      return okAsync(makeIssue({ state: to }))
    },
    checkAcceptanceCriteria: () => okAsync(true),
    writeIssue: () => okAsync(makeIssue({ state: 'PLANNED' })),
  })

  await runLoop('001', 'build', config, provider, customDeps)
  expect(transitionTargets).not.toContain('BUILT')
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/unit/batch-runloop.test.ts -t "pre-complete"`
Expected: FAIL — `runPreComplete` not in RunLoopDeps yet

**Step 3: Update `RunLoopDeps` and `batch.ts` integration**

In `src/core/batch.ts`:

1. Import `runPreComplete` and `toFixSteps`:

```typescript
import { runPreComplete, toFixSteps } from '@/core/pre-complete'
import type { PreCompleteResult } from '@/core/pre-complete'
```

2. Add to `RunLoopDeps`:

```typescript
export type RunLoopDeps = {
  runClaudeIteration?: typeof runClaudeIteration
  verifyIssue?: typeof verifyIssue
  runPreComplete?: typeof runPreComplete
}
```

3. Replace the inline testCommand block (lines ~354-385) with:

```typescript
// Build mode: check acceptance criteria + pre-complete (fix + test gate)
if (mode === 'build') {
  const criteriaResult = await provider.checkAcceptanceCriteria(issueId)
  const criteriaMet = criteriaResult.isOk() && criteriaResult.value

  if (criteriaMet) {
    const _runPreComplete = deps.runPreComplete ?? runPreComplete
    const fixSteps = toFixSteps(config.fixCommands)
    const preResult = await _runPreComplete(
      fixSteps,
      config.testCommand || undefined,
    )
    const preOutcome = preResult._unsafeUnwrap()

    if (preOutcome.passed) {
      const fresh = await provider.fetchIssue(issueId)
      if (fresh.isOk() && fresh.value.state !== 'BUILT') {
        await provider.transition(issueId, 'BUILT')
      }
      // Run verification immediately after BUILT
      const verifyResult = await _verifyIssue(issueId, config, provider)
      if (verifyResult.isErr()) {
        logger.warn(
          { issueId, err: verifyResult.error.message },
          'verification failed after BUILT',
        )
      }
      break
    }
    logger.warn({ issueId, iteration }, 'pre-complete failed — continuing')
  }
}
```

**Step 4: Run all batch tests to verify they pass**

Run: `bun test tests/unit/batch-runloop.test.ts`
Expected: PASS (all existing + new tests)

**Step 5: Run full test suite**

Run: `bun test`
Expected: All 413+ tests pass

**Step 6: Commit**

```bash
git add src/core/batch.ts tests/unit/batch-runloop.test.ts
git commit -m "feat: integrate pre-complete fix+test gate into build loop"
```

---

### Task 4: Update existing batch tests for backward compatibility

**Files:**
- Modify: `tests/unit/batch-runloop.test.ts`

**Step 1: Verify existing tests still pass with no fixCommands configured**

The `defaultConfig()` returns `fixCommands: []` and `testCommand: ''`, so existing tests that use `defaultConfig()` should be unaffected. The inline `testCommand` tests (line 253) that set `testCommand: 'true'` now route through `runPreComplete` — verify these still pass.

Run: `bun test tests/unit/batch-runloop.test.ts`
Expected: PASS

If any existing tests fail due to the `runPreComplete` dep not being mocked, add the default mock to the shared `deps` object (already done in Task 3 Step 1).

**Step 2: Commit if any fixups needed**

```bash
git add tests/unit/batch-runloop.test.ts
git commit -m "test: ensure backward compat for pre-complete integration"
```

---

### Task 5: Final verification

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 2: Run type check**

Run: `bun run check`
Expected: No errors

**Step 3: Run build**

Run: `bun run build`
Expected: Clean build

**Step 4: Final commit (if any lint/format changes)**

```bash
git add -A
git commit -m "chore: lint and format fixes"
```
