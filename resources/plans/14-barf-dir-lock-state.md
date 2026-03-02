# Plan: `.barf/` Runtime Lock State

## Context

The current locking mechanism in `LocalIssueProvider` produces two artifacts per active issue:

1. A `.locks/<id>/` directory (POSIX `mkdir` atomicity)
2. A `.md.working` file rename (in-progress signal)

Both pollute `git status`, neither carries runtime metadata (who holds the lock, when, why). If a barf process crashes, the `.locks/` dir and `.md.working` file persist permanently — no TTL, no recovery path. The next run sees the issue as locked and skips it forever.

**Goal:** Replace both artifacts with a single `.barf/<id>.lock` JSON file that:
- Is created atomically via `O_CREAT | O_EXCL` (POSIX, as atomic as `mkdir`)
- Carries PID, timestamp, current state, and mode
- Auto-cleans stale locks (dead PID) on the next `isLocked()` call
- Lives in a `.barf/` directory at project root (gitignored), separate from `issues/`

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `LockMode`, `LockInfo` types; add `barfDir` to `ConfigSchema` |
| `src/core/config.ts` | Add `BARF_DIR → barfDir` to `KEY_MAP` |
| `src/core/issue-providers/factory.ts` | Pass `config.barfDir` to `LocalIssueProvider` |
| `src/core/issue-providers/base.ts` | Update `lockIssue` abstract signature to accept optional `meta` |
| `src/core/issue-providers/local.ts` | Major rewrite of lock methods; add `barfDir` constructor param |
| `src/core/issue-providers/github.ts` | Accept (and ignore) new `meta` param in `lockIssue` |
| `src/core/batch.ts` | Pass `{ mode }` to `lockIssue` calls |
| `tests/unit/issue-providers/local.test.ts` | Update constructor calls; add stale-lock recovery test |
| `.gitignore` | Add `.barf/` |

## Implementation Steps

### 1. `src/types/index.ts`

Add before `ConfigSchema`:

```typescript
/** Runtime mode that acquired the lock. */
export const LockModeSchema = z.enum(['plan', 'build', 'split'])
/** A barf lock mode. Derived from {@link LockModeSchema}. */
export type LockMode = z.infer<typeof LockModeSchema>

/**
 * Contents of a `.barf/<id>.lock` file. Written atomically at lock acquisition.
 * Used for stale-lock detection (dead PID) and status display.
 */
export const LockInfoSchema = z.object({
  pid: z.number().int().positive(),
  acquiredAt: z.string().datetime(),
  state: IssueStateSchema,
  mode: LockModeSchema
})
/** Parsed lock file contents. Derived from {@link LockInfoSchema}. */
export type LockInfo = z.infer<typeof LockInfoSchema>
```

Add `barfDir` to `ConfigSchema`:

```typescript
barfDir: z.string().default('.barf'),
```

### 2. `src/core/config.ts`

Add to `KEY_MAP` in `parseBarfrc`:

```typescript
BARF_DIR: 'barfDir',
```

Also add to `RawConfigSchema.extend({...})` if needed (it inherits `barfDir` from ConfigSchema automatically via `extend`).

### 3. `src/core/issue-providers/base.ts`

Update `lockIssue` abstract signature and TSDoc:

```typescript
/**
 * Acquires an exclusive lock on the issue.
 *
 * - `LocalIssueProvider`: `O_CREAT | O_EXCL` atomic file creation in `.barf/<id>.lock`
 * - `GitHubIssueProvider`: adds the `barf:locked` label (meta ignored)
 *
 * @param id - Issue to lock.
 * @param meta - Optional metadata written into the lock record.
 * @returns `ok(void)` on success, `err(Error)` if the issue is already locked.
 * @example
 * const result = await provider.lockIssue('001', { mode: 'build' });
 * if (result.isErr()) throw new Error('Already locked by another process');
 */
abstract lockIssue(id: string, meta?: { mode?: LockMode }): ResultAsync<void, Error>
```

Import `LockMode` from `@/types/index`.

### 4. `src/core/issue-providers/local.ts`

Full rewrite of the lock-related methods. Key changes:

**Constructor** — add `barfDir` param, `mkdir -p` on construction:

```typescript
constructor(
  private issuesDir: string,
  private barfDir: string
) {
  super()
  mkdirSync(barfDir, { recursive: true })
}
```

**Remove** `lockDir()` helper. **Replace** `issuePath()` — no more `.working` check:

```typescript
private issuePath(id: string): string {
  return join(this.issuesDir, `${id}.md`)
}

private lockPath(id: string): string {
  return join(this.barfDir, `${id}.lock`)
}
```

**`listIssues()`** — remove `.md.working` handling. Only scan `.md` files:

```typescript
if (!entry.endsWith('.md')) continue
const id = entry.replace(/\.md$/, '')
```
(Remove the `seen` dedup set and `.md.working` branch — no longer needed.)

**`lockIssue(id, meta?)`** — atomic file creation with `O_EXCL`:

```typescript
lockIssue(id: string, meta?: { mode?: LockMode }): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      // Read current state for the lock record
      const content = readFileSync(this.issuePath(id), 'utf8')
      const stateMatch = content.match(/^state=(.+)$/m)
      const state = IssueStateSchema.catch('NEW').parse(stateMatch?.[1]?.trim())

      const lockData: LockInfo = {
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
        state,
        mode: meta?.mode ?? 'build'
      }

      // O_CREAT | O_EXCL: atomic, throws EEXIST if another process holds the lock
      const fd = openSync(
        this.lockPath(id),
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY
      )
      try {
        writeSync(fd, JSON.stringify(lockData))
      } finally {
        closeSync(fd)
      }
    }),
    e => (e instanceof Error ? e : new Error(String(e)))
  )
}
```

**`unlockIssue(id)`** — just `unlink`:

```typescript
unlockIssue(id: string): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      rmSync(this.lockPath(id), { force: true })
    }),
    e => (e instanceof Error ? e : new Error(String(e)))
  )
}
```

**`isLocked(id)`** — PID check + auto-clean stale locks:

```typescript
isLocked(id: string): ResultAsync<boolean, Error> {
  return ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      const lockFile = this.lockPath(id)
      if (!existsSync(lockFile)) return false

      let info: LockInfo
      try {
        info = LockInfoSchema.parse(JSON.parse(readFileSync(lockFile, 'utf8')))
      } catch {
        // Corrupt/unreadable lock file — treat as stale
        rmSync(lockFile, { force: true })
        return false
      }

      try {
        process.kill(info.pid, 0) // signal 0: check existence only
        return true               // process alive → lock is valid
      } catch {
        // ESRCH: process dead → stale lock, auto-clean
        rmSync(lockFile, { force: true })
        return false
      }
    }),
    e => (e instanceof Error ? e : new Error(String(e)))
  )
}
```

**Imports to add:** `openSync`, `writeSync`, `closeSync`, `constants` from `'fs'`.
**Imports to add:** `LockInfo`, `LockInfoSchema`, `IssueStateSchema`, `LockMode` from `'@/types/index'`.
**Remove:** `renameSync`, `mkdirSync` (unless still used), `existsSync` re-export of working path logic.

### 5. `src/core/issue-providers/github.ts`

Update `lockIssue` signature to accept (and ignore) `meta`:

```typescript
lockIssue(id: string, _meta?: { mode?: LockMode }): ResultAsync<void, Error> {
```

Import `LockMode` from `@/types/index`.

### 6. `src/core/issue-providers/factory.ts`

Pass `barfDir` to `LocalIssueProvider`:

```typescript
return ok(new LocalIssueProvider(config.issuesDir, config.barfDir))
```

### 7. `src/core/batch.ts`

Find `lockIssue` call sites and pass mode. Example:

```typescript
// plan mode
await provider.lockIssue(issue.id, { mode: 'plan' })

// build mode
await provider.lockIssue(issue.id, { mode: 'build' })

// split
await provider.lockIssue(issue.id, { mode: 'split' })
```

### 8. `tests/unit/issue-providers/local.test.ts`

Update `beforeEach` to pass `barfDir`:

```typescript
const barfDir = join(dir, '.barf')
provider = new LocalIssueProvider(join(dir, 'issues'), barfDir)
```

Add new tests:

```typescript
it('isLocked returns false after process dies (stale lock recovery)', async () => {
  // Manually write a lock file with a dead PID
  mkdirSync(join(dir, '.barf'), { recursive: true })
  writeFileSync(
    join(dir, '.barf', '001.lock'),
    JSON.stringify({ pid: 999999999, acquiredAt: new Date().toISOString(), state: 'PLANNED', mode: 'build' })
  )
  const result = await provider.isLocked('001')
  expect(result._unsafeUnwrap()).toBe(false)
  // Lock file should be cleaned up
  expect(existsSync(join(dir, '.barf', '001.lock'))).toBe(false)
})

it('issue file is never renamed to .working', async () => {
  await provider.lockIssue('001')
  expect(existsSync(join(dir, 'issues', '001.md'))).toBe(true)
  expect(existsSync(join(dir, 'issues', '001.md.working'))).toBe(false)
})
```

Update existing lock test to not assume `.working` behavior (it should still pass as-is since `lockIssue`/`unlockIssue` semantics are unchanged from the test's perspective).

### 9. `.gitignore`

Add:

```
.barf/
```

## Recovery Behavior

When a barf process crashes mid-run:

1. `.barf/<id>.lock` remains (with the dead PID)
2. `issues/<id>.md` is in whatever state was last written (atomic writes guarantee no partial state)
3. On the next `barf build` or `barf auto`, `autoSelect()` calls `isLocked()` for each issue
4. `isLocked()` finds the lock file, checks `process.kill(pid, 0)` → `ESRCH` → deletes lock file → returns `false`
5. The issue is now available; `autoSelect()` picks it up in its current state (`PLANNED` → immediately resumed in build mode)

No manual intervention required.

## Verification

```bash
# 1. Run existing tests (should pass after updates)
bun test

# 2. Format and lint
bun run check

# 3. Manual smoke test
bun run dev build --issue 001   # creates .barf/001.lock during run
ls -la .barf/                    # should show 001.lock with JSON content
cat .barf/001.lock               # verify { pid, acquiredAt, state, mode }

# 4. Stale lock recovery
echo '{"pid":999999999,"acquiredAt":"2026-01-01T00:00:00.000Z","state":"PLANNED","mode":"build"}' > .barf/001.lock
bun run dev build --issue 001   # should auto-clear stale lock and proceed
```

## Non-goals

- Migrating old `.locks/` dirs or `.md.working` files automatically — users can `rm -rf issues/.locks issues/*.md.working`
- Changing `GitHubIssueProvider` locking strategy (label-based, out of scope)
- Cross-machine distributed locks (`.barf/` is local-only)
