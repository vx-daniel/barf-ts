# Issue Providers

**Source:** `src/core/issue/`

The `IssueProvider` abstraction decouples barf's orchestration logic from where issues are stored. The same batch loop works whether issues are local markdown files or GitHub Issues.

## Provider Interface (`base.ts`)

```typescript
abstract class IssueProvider {
  // Abstract — must implement:
  abstract readIssue(id: string): ResultAsync<Issue, Error>
  abstract writeIssue(issue: Issue): ResultAsync<Issue, Error>
  abstract deleteIssue(id: string): ResultAsync<void, Error>
  abstract listIssues(): ResultAsync<Issue[], Error>
  abstract lockIssue(id: string, info: LockInfo): ResultAsync<void, Error>
  abstract unlockIssue(id: string): ResultAsync<void, Error>
  abstract isLocked(id: string): ResultAsync<LockInfo | null, Error>
  abstract initProject(): ResultAsync<void, Error>

  // Provided (shared logic):
  transition(issue, nextState): ResultAsync<Issue, Error>
  autoSelect(mode): ResultAsync<Issue | null, Error>
  checkAcceptanceCriteria(issue): Result<CriteriaResult, Error>
}
```

## Factory (`factory.ts`)

```typescript
createIssueProvider(config: Config): IssueProvider
// Returns LocalIssueProvider or GitHubIssueProvider based on config.issueProvider
```

## Local Provider (`providers/local.ts`)

Issues stored as `.md` files in `issuesDir`.

**Locking:** POSIX atomic file creation

```mermaid
flowchart LR
    A[lockIssue] --> B["open(.barf/id.lock, O_CREAT|O_EXCL)\natomic — fails if already exists"]
    B --> C[write LockInfo JSON\npid + timestamp + state + mode]

    D[isLocked] --> E[read lock file]
    E --> F{PID alive?}
    F -- no --> G[sweep stale lock\nunlink file]
    F -- yes --> H[return LockInfo]
```

Stale lock cleanup runs on every `isLocked` and `lockIssue` call — dead PIDs are automatically removed, preventing orphaned locks from crashes.

**Writes:** Atomic via temp file + rename

```mermaid
flowchart LR
    A[writeIssue] --> B["write to .barf/id.tmp"]
    B --> C["rename to issuesDir/id.md\nPOSIX atomic"]
```

## GitHub Provider (`providers/github.ts`)

Issues mapped to GitHub Issues via the `gh` CLI.

**State → Label mapping:**

```
NEW          → barf:new
GROOMED      → barf:groomed
PLANNED      → barf:planned
IN_PROGRESS  → barf:in_progress
COMPLETED    → barf:completed
VERIFIED     → barf:verified
STUCK        → barf:stuck
SPLIT        → barf:split
```

**Locking:** Label-based (not atomic — single-agent design)

```
lockIssue:    add label "barf:locked" via gh CLI
unlockIssue:  remove label "barf:locked"
isLocked:     check for "barf:locked" label
```

**Constraints vs Local:**
- Cannot `deleteIssue` — transitions to COMPLETED instead
- Locking is not atomic; designed for single-agent use
- Issue body = markdown content; frontmatter stored in issue body header
- `initProject` creates barf labels in the GitHub repo

## LockInfo Schema

```typescript
type LockInfo = {
  pid: number           // process ID that holds the lock
  timestamp: string     // ISO 8601 when lock was acquired
  state: IssueState     // issue state at lock time
  mode: LockMode        // 'plan' | 'build' | 'triage' | 'verify'
}
```

## autoSelect Logic

Picks the next issue to work on based on priority ordering:

```
build mode:  IN_PROGRESS → PLANNED → (nothing)
plan mode:   GROOMED → NEW (needs_interview=false) → (nothing)
triage mode: NEW (needs_interview=undefined) → (nothing)
```

Skips locked issues. Returns `null` if nothing actionable.
