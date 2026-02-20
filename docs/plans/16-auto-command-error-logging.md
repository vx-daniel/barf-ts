# Plan 16: Fix Silent Failure in `autoCommand` + Context Status Display

## Context

Two bugs surfaced during GitHub provider testing:

1. **Silent exit in `autoCommand`**: `barf auto` exits with code 0 and no output when `provider.listIssues()` fails (e.g. `gh` not authenticated, repo not found, network error). The loop breaks silently on `listResult.isErr()`. This explains the user seeing "no error" despite a real failure.

2. **Context status line shows wrong denominator** (`src/core/claude.ts`, already staged): The TTY status line was dividing by `threshold` instead of `contextLimit`. This showed token percentage relative to the interrupt threshold, not the full model context window. Already fixed in the working tree — just needs to be committed.

---

## Fix 1: `autoCommand` error logging (`src/cli/commands/auto.ts`)

**Current (broken):**
```typescript
if (listResult.isErr()) {
  break   // ← silent! no log, exits 0
}
```

**Fix:**
```typescript
if (listResult.isErr()) {
  logger.error({ err: listResult.error }, listResult.error.message)
  process.exit(1)
}
```

**Also add**: a debug-level log when the loop exits normally (no actionable issues):
```typescript
if (toPlan.length === 0 && toBuild.length === 0) {
  logger.info('no actionable issues — done')
  break
}
```

**File**: `src/cli/commands/auto.ts`

---

## Fix 2: Commit context status line fix (`src/core/claude.ts`)

Already in working tree (per git diff). Change is:
- Added `const contextLimit = MODEL_CONTEXT_LIMITS[model] ?? 200_000`
- Status line: `event.tokens / contextLimit` (full window %) instead of `event.tokens / threshold`

No code changes needed — just include in the commit.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/cli/commands/auto.ts` | Error log + `process.exit(1)` on `listIssues()` failure; info log on clean exit |

## Files Already Modified (commit-only)

| File | Change |
|------|--------|
| `src/core/claude.ts` | Context status line denominator fix (already staged) |

---

## Tests to Add

Add to `tests/unit/` a new test file `auto.test.ts` (or extend batch.test.ts) covering:

- `autoCommand` exits (via mocked `process.exit`) with code 1 when `listIssues()` returns `err`
- `autoCommand` exits cleanly when list is empty (no actionable issues)

Since `autoCommand` calls `process.exit(1)`, tests should spy/mock `process.exit`.

---

## Verification

```bash
# 1. Run tests
bun test

# 2. Simulate auth failure (unset GH_TOKEN, point at nonexistent repo)
bun run dev --config tests/sample-project/.barfrc.github --cwd tests/sample-project auto
# Expected: error log + exit code 1 (echo $? → 1)

# 3. Run with valid config + empty repo
# Expected: "no actionable issues — done" log + exit code 0
```

---

## Plan File Naming Note

This file must be renamed from `serialized-dazzling-llama.md` to `16-auto-command-error-logging.md` before the task is complete (per CLAUDE.md naming requirements).
