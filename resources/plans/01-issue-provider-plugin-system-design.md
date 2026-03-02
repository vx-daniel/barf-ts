# Issue Provider Plugin System — Design

**Date:** 2026-02-18
**Status:** Approved, ready for implementation

---

## Context

barf currently assumes issues are local markdown files. This hard-coupling prevents teams that
use GitHub Issues as their source of truth from adopting barf. The goal is to extract all
issue I/O behind an `IssueProvider` abstraction so the engine is backend-agnostic, then ship
two built-in providers: `local` (current file-based system) and `github` (GitHub REST API).

Future providers (Linear, Jira, etc.) can be added without touching core logic.

---

## Architecture

```
src/core/
  issue-providers/
    base.ts      ← abstract IssueProvider class (shared logic)
    local.ts     ← LocalIssueProvider (wraps current file operations)
    github.ts    ← GitHubIssueProvider (GitHub API via gh CLI)
    factory.ts   ← createIssueProvider(config): IssueProvider
  issue.ts       ← pure functions unchanged (parseIssue, validateTransition, parseAcceptanceCriteria)
  config.ts      ← adds issueProvider + githubRepo fields
src/cli/commands/
  init.ts        ← creates barf:* labels in GitHub when ISSUE_PROVIDER=github
  plan.ts  build.ts  status.ts  ← receive IssueProvider as arg, no direct issue.ts calls
src/index.ts     ← constructs provider once, injects into all commands
src/utils/
  execFileNoThrow.ts  ← existing utility; used by github.ts for all gh CLI calls
```

---

## Base Class Design (`src/core/issue-providers/base.ts`)

```typescript
abstract class IssueProvider {
  // ── Abstract I/O (provider-specific) ─────────────────────────────────────
  abstract fetchIssue(id: string): Promise<Issue>
  abstract listIssues(filter?: { state?: IssueState }): Promise<Issue[]>
  abstract createIssue(input: CreateIssueInput): Promise<Issue>
  abstract writeIssue(id: string, fields: Partial<Issue>): Promise<Issue>
  abstract deleteIssue(id: string): Promise<void>
  abstract lockIssue(id: string): Promise<void>
  abstract unlockIssue(id: string): Promise<void>
  abstract isLocked(id: string): Promise<boolean>

  // ── Shared implementations (live once, not duplicated) ───────────────────
  async transition(id: string, to: IssueState): Promise<Issue>
    // validates via VALID_TRANSITIONS (throws InvalidTransitionError)
    // then delegates to writeIssue()

  async autoSelect(mode: 'plan' | 'build'): Promise<Issue | null>
    // listIssues() then applies priority: PLANNED > PLANNED > NEW

  async checkAcceptanceCriteria(id: string): Promise<boolean>
    // fetchIssue() then parseAcceptanceCriteria(issue.body)
}
```

---

## Provider: Local (`src/core/issue-providers/local.ts`)

Wraps current `issue.ts` file operations. No behavior change — just lifts the functions
into the class. POSIX `mkdir`-based locking and `.working` rename are preserved.

```typescript
class LocalIssueProvider extends IssueProvider {
  constructor(private issuesDir: string) { super() }
  // fetchIssue → parseIssue() from issue.ts
  // lockIssue  → mkdir .locks/{id} + rename .working
  // ...
}
```

---

## Provider: GitHub (`src/core/issue-providers/github.ts`)

Calls GitHub REST API via the `gh` CLI. Uses existing `execFileNoThrow` utility
(`src/utils/execFileNoThrow.ts`) for all subprocess calls — prevents shell injection
and handles errors cleanly. Token obtained once via `gh auth token` at provider construction.

### State Mapping

| barf `IssueState`  | GitHub representation                        |
|--------------------|----------------------------------------------|
| `NEW`              | Label `barf:new`                             |
| `PLANNED`          | Label `barf:planned`                         |
| `PLANNED`      | Label `barf:built`                     |
| `STUCK`            | Label `barf:stuck`                           |
| `SPLIT`            | Label `barf:split`                           |
| `BUILT`        | Label `barf:complete` + issue **closed**    |

### Other Mappings

| barf concept        | GitHub representation                              |
|---------------------|----------------------------------------------------|
| Parent issue        | Milestone (groups related/split issues)            |
| Child issues        | GitHub Sub-Issues API (native, 2024)               |
| Lock                | Label `barf:locked` (best-effort, single-machine)  |
| Auth                | `execFileNoThrow('gh', ['auth', 'token'])` at init |

```typescript
class GitHubIssueProvider extends IssueProvider {
  private token: string
  constructor(private repo: string) {
    super()
    // token resolved via execFileNoThrow('gh', ['auth', 'token'])
  }
  // fetchIssue  → execFileNoThrow('gh', ['api', `/repos/${repo}/issues/${id}`])
  // listIssues  → gh api with label filter
  // lockIssue   → gh api --method POST .../labels  body: {labels:["barf:locked"]}
  // createIssue → gh api --method POST .../issues
  // writeIssue  → gh api --method PATCH .../issues/{n}
}
```

---

## Provider Factory (`src/core/issue-providers/factory.ts`)

```typescript
function createIssueProvider(config: Config): IssueProvider {
  switch (config.issueProvider) {
    case 'github':
      if (!config.githubRepo) throw new Error('GITHUB_REPO required when ISSUE_PROVIDER=github')
      return new GitHubIssueProvider(config.githubRepo)
    case 'local':
    default:
      return new LocalIssueProvider(config.issuesDir)
  }
}
```

---

## Config Changes

**`.barfrc` additions:**
```bash
ISSUE_PROVIDER=local    # or: github (default: local)
GITHUB_REPO=owner/repo  # required when ISSUE_PROVIDER=github
```

**`Config` type additions (`src/types/index.ts`):**
```typescript
issueProvider: 'local' | 'github'  // default: 'local'
githubRepo: string                  // e.g. "anthropics/barf"
```

---

## CLI Integration (`src/index.ts`)

```typescript
const config = loadConfig()
const issues = createIssueProvider(config)  // constructed once

program.command('plan').action(() => planCommand(issues, config))
program.command('build').action(() => buildCommand(issues, config))
program.command('status').action(() => statusCommand(issues, config))
```

---

## `barf init` Changes

When `ISSUE_PROVIDER=github`, init calls GitHub API to create the `barf:*` labels
(`barf:new`, `barf:planned`, `barf:built`, `barf:stuck`, `barf:split`,
`barf:complete`, `barf:locked`) in the configured repo if they don't exist.

---

## Out of Scope (Future)

- `barf migrate --from=local --to=github` — cross-provider migration command
- Third-party provider loading (Linear, Jira, etc.) — interface is stable for this extension

---

## Verification

1. `bun test` — all existing unit tests pass (LocalIssueProvider is behavior-equivalent to old issue.ts functions)
2. `bun build --compile --outfile=dist/barf src/index.ts` — compiles clean
3. Local provider smoke test: `ISSUE_PROVIDER=local ./dist/barf status`
4. GitHub provider smoke test (requires `gh auth login`): `ISSUE_PROVIDER=github GITHUB_REPO=owner/repo ./dist/barf status`
5. `barf init` on a GitHub-configured project creates all `barf:*` labels in the repo
6. `barf plan` on a GitHub project creates a GitHub Issue with `barf:new` label and transitions correctly through the state machine
