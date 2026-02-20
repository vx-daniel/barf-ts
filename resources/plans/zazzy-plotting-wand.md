# Fix TypeDoc broken `{@link}` warnings

## Context

Running `npm run docs` produces 8 warnings, all `Failed to resolve link`. TypeDoc
resolves `{@link Symbol}` from the declaring module's import scope — if the symbol
isn't imported there, it fails even with `entryPointStrategy: expand`.

Three unresolvable references exist:

| Symbol | In file | Why unresolvable |
|--------|---------|-----------------|
| `LocalIssueProvider` | `base.ts:lockIssue` | Would be circular — `local.ts` extends `base.ts` |
| `GitHubIssueProvider` | `base.ts:lockIssue` | Same circular reason |
| `VALID_TRANSITIONS` | `base.ts:transition @param to` | Not imported; only `validateTransition` is |
| `parseClaudeStream` | `types/index.ts:ClaudeEventSchema` | Circular — `context.ts` imports from `types/index.ts` |

The 4 source-level failures propagate to 8 warnings because TypeDoc re-resolves
inherited comments for each subclass (`LocalIssueProvider`, `GitHubIssueProvider`).

## Files to Modify

| File | Change |
|------|--------|
| `src/core/issue-providers/base.ts` | 3 `{@link}` → backticks (lockIssue ×2, transition @param to ×1) |
| `src/types/index.ts` | 1 `{@link}` → backtick (ClaudeEventSchema body) |

## Implementation

### `src/core/issue-providers/base.ts` — `lockIssue`

```diff
-  * - {@link LocalIssueProvider}: `mkdir` atomicity + renames `.md` → `.md.working`
-  * - {@link GitHubIssueProvider}: adds the `barf:locked` label
+  * - `LocalIssueProvider`: `mkdir` atomicity + renames `.md` → `.md.working`
+  * - `GitHubIssueProvider`: adds the `barf:locked` label
```

### `src/core/issue-providers/base.ts` — `transition @param to`

```diff
-  * @param to - Target state; must be reachable from the current state per {@link VALID_TRANSITIONS}.
+  * @param to - Target state; must be reachable from the current state per `VALID_TRANSITIONS`.
```

### `src/types/index.ts` — `ClaudeEventSchema`

```diff
-  * Emitted by {@link parseClaudeStream}.
+  * Emitted by `parseClaudeStream` in `core/context`.
```

## Verification

```bash
npm run docs   # 0 warnings
bun test       # 145 tests still pass
```
