# Plan: Rename Issue States + Active Indicator

## Context

The current state machine uses `IN_PROGRESS` as a transient state while Claude builds, but this is unnecessary — the `runningId` signal already tracks active work. Renaming `COMPLETED→BUILT` and `VERIFIED→COMPLETE` better reflects intent: "built" means Claude finished, "complete" means verified.

**New state machine:**
```
NEW → GROOMED → PLANNED → BUILT → COMPLETE
                   ↘                    ↑
                    STUCK ←→ SPLIT
```

Issues stay `PLANNED` while building. A pulsing border + spinner badge on KanbanCards shows active work.

---

## Phase 1: Schema (source of truth)

**`src/types/schema/issue-schema.ts`**
- Remove `'IN_PROGRESS'` from `IssueStateSchema` enum
- Rename `'COMPLETED'` → `'BUILT'`, `'VERIFIED'` → `'COMPLETE'`
- Update `VALID_TRANSITIONS`:
  ```
  PLANNED: ['BUILT', 'STUCK', 'SPLIT']
  BUILT: ['COMPLETE']
  COMPLETE: []
  ```
  Remove `IN_PROGRESS` entry entirely.
- Update all TSDoc comments/diagrams

> After this, `Record<IssueState, ...>` maps across the codebase will produce compile errors — these guide the remaining work.

## Phase 2: Core orchestration

| File | Change |
|------|--------|
| `src/core/batch/loop.ts` | **Remove** the block that transitions PLANNED→IN_PROGRESS at build start. Change `'COMPLETED'` break check → `'BUILT'` |
| `src/core/batch/outcomes.ts` | `handleBuildCompletion`: transition to `'BUILT'` instead of `'COMPLETED'` |
| `src/core/verification/orchestration.ts` | `'VERIFIED'` → `'COMPLETE'`, update "leaving as COMPLETED" message → `'BUILT'` |
| `src/core/issue/base.ts` | Remove IN_PROGRESS mode mapping if present |

## Phase 3: CLI commands

| File | Change |
|------|--------|
| `src/cli/commands/build.ts` | `BUILDABLE` set: remove `'IN_PROGRESS'` |
| `src/cli/commands/auto.ts` | `BUILD_STATES`: remove `'IN_PROGRESS'`. Rename `'COMPLETED'`→`'BUILT'`, `'VERIFIED'`→`'COMPLETE'` throughout |
| `src/cli/commands/audit.ts` | `'COMPLETED'` → `'BUILT'` throughout |

## Phase 4: Providers + Prompts

| File | Change |
|------|--------|
| `src/core/issue/providers/github-labels.ts` | Remove IN_PROGRESS label, rename COMPLETED→BUILT, VERIFIED→COMPLETE |
| `src/prompts/PROMPT_build.md` | Remove IN_PROGRESS references, COMPLETED→BUILT |

## Phase 5: Dashboard frontend

**`tools/dashboard/frontend/lib/constants.ts`**
- All `Record<IssueState, ...>` maps: remove IN_PROGRESS, rename COMPLETED→BUILT, VERIFIED→COMPLETE
- `STATE_ORDER`: `['NEW', 'GROOMED', 'PLANNED', 'BUILT', 'COMPLETE', 'STUCK']`
- `PIPELINE_STATES`: `['NEW', 'GROOMED', 'PLANNED', 'BUILT', 'COMPLETE']`
- `CMD_ACTIONS`: `BUILT: ['audit'], COMPLETE: []`
- `STATE_EMOJI`: `BUILT: '✅', COMPLETE: '🏆'`
- `contextBarColor`: replace `var(--color-state-in-progress)` → `var(--color-warning)` (it's used for context % bars, unrelated to the state)

**`tools/dashboard/frontend/styles/index.css`**
- Remove `--color-state-in-progress` and its palette var
- Rename `--color-state-completed` → `--color-state-built`
- Rename `--color-state-verified` → `--color-state-complete`
- Add pulse animation keyframe for active indicator:
  ```css
  @keyframes pulse-border {
    0%, 100% { border-left-color: var(--sc); }
    50% { border-left-color: var(--color-primary); }
  }
  .animate-pulse-border { animation: pulse-border 1.5s ease-in-out infinite; }
  ```

**`tools/dashboard/frontend/components/KanbanBoard.tsx`**
- Replace `opacity-70` with active indicator:
  ```tsx
  className={`... ${running ? 'animate-pulse-border' : ''}`}
  ```
- Add spinner badge next to `#{issue.id}`:
  ```tsx
  {running && <span className="loading loading-spinner loading-xs text-primary" />}
  ```

**`tools/dashboard/frontend/components/Sidebar.tsx`**
- `EXPECTS_PLAN` set: `new Set(['PLANNED', 'BUILT'])`

**`tools/dashboard/frontend/components/StatusBar.tsx`**
- Replace `--color-state-in-progress` refs → `--color-state-planned` or `--color-warning`

## Phase 6: Tests

Mechanical rename across all test files. Key files:
- `tests/unit/issue.test.ts` — transition tests: remove IN_PROGRESS, add PLANNED→BUILT, BUILT→COMPLETE
- `tests/unit/batch-runloop.test.ts` — remove IN_PROGRESS transitions, COMPLETED→BUILT
- `tests/unit/auto.test.ts` — BUILD_STATES, COMPLETED/VERIFIED→BUILT/COMPLETE
- `tests/unit/audit.test.ts`, `tests/unit/audit-full.test.ts` — COMPLETED→BUILT
- `tests/unit/issue-providers/github.test.ts` — label mapping tests
- `tests/unit/issue-providers/local.test.ts`
- `tests/integration/audit-pipeline.test.ts`
- `tests/fixtures/provider.ts`

## Phase 7: Documentation + Sample project

- `tests/sample-project/issues/*.md` — update `state=` frontmatter values
- `CLAUDE.md`, `README.md`, `PRD.md` — state machine diagrams
- `resources/architecture/*.md` — all 8 docs
- `resources/plans/*.md` — update all plan files
- `tools/playground-server.ts` — legacy duplicated constants

## Verification

1. `bun tsc --noEmit` — compiler catches missing `Record<IssueState, ...>` entries
2. `bun test` — all 488 tests pass
3. `bun run dashboard:build` — frontend builds cleanly
4. Manual: open dashboard, verify kanban columns show NEW/GROOMED/PLANNED/BUILT/COMPLETE/STUCK
5. Manual: run a build command, verify pulsing border + spinner on the active card
