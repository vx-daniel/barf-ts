# 051 — Parallel Issue Processing

## Context

barf currently processes issues sequentially by default (`--batch 1`). The `build` and `auto` commands already use `Promise.allSettled` for concurrent builds, but:

1. **No configurable concurrency** — `--batch` is CLI-only, no `.barfrc` default
2. **Stats race condition** — `persistSessionStats` does read-modify-write without holding the lock (lock is released in `finally` *after* stats persist, but concurrent processes on *different* issues writing their own stats are fine — the real risk is if stats persistence fails mid-write)
3. **TTY output interleaves** — multiple concurrent loops write to stderr/stdout without coordination
4. **No cross-process safety guarantee** — running `barf build 42` in one terminal and `barf auto` in another could conflict if auto picks issue 42

**Goal:** Make barf safe and pleasant to run with 2-3+ concurrent issue loops (in-process via `--batch`) AND across separate terminal invocations (dashboard interviews + auto builds).

## Changes

### 1. Add `maxConcurrency` config field

**File:** `src/types/schema/config-schema.ts`

```typescript
maxConcurrency: z.number().int().min(1).default(1),
```

**File:** `src/core/config.ts` — add `MAX_CONCURRENCY` to the KEY=VALUE parser mapping.

**File:** `src/cli/commands/build.ts` — use `config.maxConcurrency` as default for `opts.batch`:
```typescript
// Currently: opts.batch is hardcoded default 1 in commander
// Change: default to config.maxConcurrency
.option('--batch <n>', 'max concurrent builds', config.maxConcurrency)
```

**File:** `src/cli/commands/auto.ts` — same: `opts.batch` defaults to `config.maxConcurrency`.

### 2. Fix stats persistence ordering (already safe, but verify)

**File:** `src/core/batch/loop.ts` lines 303-316

Current flow in `finally`:
1. `persistSessionStats(issueId, stats, provider)` — writes to issue file
2. `provider.unlockIssue(issueId)` — releases lock

This is already correct — stats are persisted *while the lock is held*. The read-modify-write in `persistSessionStats` is safe because the POSIX lock prevents any other process from modifying the same issue file concurrently.

**No code change needed** — just add a comment clarifying why the ordering matters.

### 3. Prefix TTY output with issue ID when concurrent

**File:** `src/core/claude/display.ts`

When `maxConcurrency > 1` (or when multiple loops are active), prefix each stderr line with `[issueId]`. Pass `issueId` into the display functions (it's already available in `DisplayContext`).

**File:** `src/core/batch/loop.ts` line 232 — the `__BARF_STATS__` stdout line already includes issue context in the JSON. No change needed.

### 4. Concurrency limiter for in-process batch

**File:** `src/core/batch/limiter.ts` (new)

Create a simple semaphore/concurrency limiter:

```typescript
export function createLimiter(concurrency: number) {
  let running = 0
  const queue: Array<() => void> = []

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (running >= concurrency) {
      await new Promise<void>(resolve => queue.push(resolve))
    }
    running++
    try {
      return await fn()
    } finally {
      running--
      queue.shift()?.()
    }
  }
}
```

**File:** `src/cli/commands/build.ts` — wrap `Promise.allSettled` with limiter:
```typescript
const limit = createLimiter(opts.batch)
const results = await Promise.allSettled(
  candidates.map(issue => limit(() => runLoop(issue.id, 'build', ...)))
)
```

Currently `build.ts` slices candidates to `opts.batch` count but runs them ALL at once. With the limiter, we can pick MORE candidates but limit how many run simultaneously — better for large backlogs.

**File:** `src/cli/commands/auto.ts` — same pattern for the build phase.

### 5. Cross-process safety (already works, document it)

The POSIX locking (`O_CREAT | O_EXCL`) in `LocalIssueProvider` already prevents two processes from working the same issue. When `barf auto` tries to lock an issue that a dashboard interview is holding, it gets an error and skips it (line 84-87 of `loop.ts`).

**No code change needed** — the existing `lockIssue` error handling in `runLoop` already handles this gracefully. The lock acquisition failure is caught and the issue is skipped.

However, `auto.ts` should log more clearly when an issue is skipped due to lock contention:

**File:** `src/cli/commands/auto.ts` — when `runLoop` returns an error that's a lock contention, log it as info (not warn) since it's expected in multi-terminal use.

### 6. Dashboard coexistence

The dashboard's interview flow uses WebSocket subprocess (`tools/dashboard/routes/ws.ts`) which spawns `claude` CLI as a child process. This doesn't go through barf's locking at all — it's a separate Claude session.

**Concern:** If a user is interviewing issue 42 in the dashboard while `barf auto` tries to triage/build it, there's a conflict. The interview doesn't lock the issue.

**Fix:** The dashboard's interview should lock the issue while the interview subprocess is running. This is a separate change but worth noting.

**File:** `tools/dashboard/routes/ws.ts` — acquire lock before spawning interview subprocess, release on close.

## Files to modify

| File | Change |
|------|--------|
| `src/types/schema/config-schema.ts` | Add `maxConcurrency` field |
| `src/core/config.ts` | Map `MAX_CONCURRENCY` env/rc key |
| `src/core/batch/limiter.ts` | **New** — concurrency semaphore |
| `src/core/batch/index.ts` | Export limiter |
| `src/cli/commands/build.ts` | Use limiter + config default |
| `src/cli/commands/auto.ts` | Use limiter + config default |
| `src/core/claude/display.ts` | Issue ID prefix when concurrent |
| `src/core/batch/loop.ts` | Comment on stats/lock ordering |
| `tools/dashboard/routes/ws.ts` | Lock issue during interview |
| `tests/unit/limiter.test.ts` | **New** — test semaphore behavior |

## Verification

1. **Unit tests:** New `limiter.test.ts` — verify semaphore limits concurrent execution, queues excess, releases correctly on error
2. **Existing tests:** `bun test` — ensure no regressions (stats, loop, build, auto)
3. **Manual test — in-process:** `barf build --batch 3` with 5+ buildable issues — verify only 3 run at once
4. **Manual test — cross-process:** Run `barf build 42` in terminal A, `barf build 42` in terminal B — verify B gets lock error and exits cleanly
5. **Manual test — dashboard coexistence:** Start dashboard interview on issue X, run `barf auto` — verify auto skips issue X
