# 028 — Pre-Complete Fix & Test Gate

## Problem

When the Claude agent finishes work and acceptance criteria are met, barf transitions
to COMPLETED then runs verification (build/check/test). Lint and format issues that
the agent could have auto-fixed instead become verification failures that spawn fix
sub-issues — wasting tokens and iterations.

## Design

Add a **pre-completion phase** between "acceptance criteria met" and COMPLETED
transition. This phase runs configurable fix commands (best-effort) then a test
gate (hard requirement).

### New config key

```
FIX_COMMANDS=biome check --apply,bun run lint --fix
```

- Comma-separated shell commands
- Each runs via `sh -c <cmd>`
- Empty/unset = skip fix phase
- Config field: `fixCommands: string[]` (default `[]`)

### New module: `src/core/pre-complete.ts`

```typescript
export interface FixStep {
  name: string
  command: string
}

export type PreCompleteResult =
  | { passed: true }
  | { passed: false; testFailure: { stdout: string; stderr: string; exitCode: number } }

export function runPreComplete(
  fixCommands: FixStep[],
  testCommand: string | undefined,
  execFn: ExecFn,
): ResultAsync<PreCompleteResult, never>
```

**Flow:**
1. Run each fix command sequentially — log warnings on failure, continue regardless
2. If `testCommand` is set, run it — must exit 0
3. Return `{ passed: true }` or `{ passed: false, testFailure }`

### Integration in `batch.ts`

Replace inline `testCommand` check with `runPreComplete()` call:

```
criteria met? → runPreComplete(fixCommands, testCommand) → passed? → COMPLETED → verifyIssue()
```

- `runPreComplete` added to `RunLoopDeps` for testability
- Failed pre-complete → continue build loop (agent gets another iteration)
- Backward compatible: no fixCommands + no testCommand = current behavior

### What stays the same

- `verification.ts` — untouched, remains post-COMPLETED read-only gate
- State machine — no transition changes
- `COMPLETED → VERIFIED` flow — unchanged

## Testing

- `tests/unit/pre-complete.test.ts` — fix commands best-effort, test gate hard, no-op when unconfigured
- `tests/unit/batch-runloop.test.ts` — updated to mock `runPreComplete` in deps

## Key semantics

| Concern | Behavior |
|---------|----------|
| Fix commands fail | Log warning, continue to tests |
| Test command fails | Block COMPLETED, continue build loop |
| No fix commands configured | Skip fix phase |
| No test command configured | Skip test gate (current behavior) |
