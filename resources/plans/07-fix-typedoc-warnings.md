# 07-fix-typedoc-warnings

## Context

`bun run docs` generates 6 TypeDoc warnings. TypeDoc validation is strict (`notExported: true`, `invalidLink: true` in `typedoc.json`). Two root causes:

1. **Not-exported type used in public API** — `SpawnFn` in `github.ts` appears in the constructor signature but is unexported
2. **Unresolved `{@link}` cross-module references** — TypeDoc's `expand` entry strategy creates per-file module scopes; bare symbol names don't resolve across module boundaries

## Warnings & Fixes

### 1. `SpawnFn` not exported — `src/core/issue-providers/github.ts:7`

**Warning:** `SpawnFn` referenced in `GitHubIssueProvider.constructor` but not exported.

**Fix:** Add `export` to the type alias.

```ts
// Before
type SpawnFn = (file: string, args?: string[]) => Promise<ExecResult>

// After
export type SpawnFn = (file: string, args?: string[]) => Promise<ExecResult>
```

### 2. Unresolved `{@link LocalIssueProvider}`, `{@link GitHubIssueProvider}` — `src/core/issue-providers/base.ts:16`

**Warning:** Two broken links in the `IssueProvider` class doc. Importing these would create circular type references (both extend `IssueProvider`).

**Fix:** Convert to inline code (backticks) — still clearly identifies the concrete classes, without the link.

```ts
// Before
* Concrete implementations: {@link LocalIssueProvider}, {@link GitHubIssueProvider}.

// After
* Concrete implementations: `LocalIssueProvider`, `GitHubIssueProvider`.
```

### 3. Unresolved `{@link loadConfig}`, `{@link parseBarfrc}` — `src/types/index.ts:54-55`

**Warning:** `@see` tags referencing functions in `src/core/config.ts`. Functions can't use `import type`, so TypeDoc can't resolve them from `types/index.ts`.

**Fix:** Remove redundant `@see` lines — `loadConfig` is already mentioned in the prose on line 51.

```ts
// Before
 * @see {@link loadConfig}
 * @see {@link parseBarfrc}

// After
 * (remove both lines)
```

### 4. Unresolved `{@link parseClaudeStream}` — `src/types/index.ts:84`

**Warning:** `@see` referencing a function in `src/core/context.ts`.

**Fix:** Convert to plain-text `@see` — TypeDoc renders this as a "See also" section without a hyperlink, which is still informative.

```ts
// Before
 * @see {@link parseClaudeStream}

// After
 * @see parseClaudeStream
```

## Files to Modify

- `src/core/issue-providers/github.ts` — line 7
- `src/core/issue-providers/base.ts` — line 16
- `src/types/index.ts` — lines 54–55, 84

## Cleanup

Delete `docs/plans/vivid-drifting-moore.md` (auto-generated plan file with wrong name).

## Verification

```bash
bun run docs
# Expected: 0 warnings, exits 0
```
