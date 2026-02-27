# Dashboard Component Reusability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate duplicated code across the dashboard frontend by extracting shared utilities and deleting dead legacy panels.

**Architecture:** Extract 3 shared utility modules (`lib/format.ts`, `lib/issue-helpers.ts`, `lib/transitions.ts`) from duplicated inline code. Move `contextBarColor` into existing `lib/constants.ts`. Delete 2 dead legacy panels that were superseded by Preact components. No new Preact components — the imperative editor panel stays imperative (CodeMirror integration), so shared helpers are plain functions, not components.

**Tech Stack:** TypeScript, Preact + htm/preact, @preact/signals

---

### Task 1: Delete dead legacy panels

**Files:**
- Delete: `tools/dashboard/frontend/panels/kanban.ts`
- Delete: `tools/dashboard/frontend/panels/status.ts`

**Step 1: Verify no imports remain**

Run: `grep -r 'panels/kanban' tools/dashboard/frontend/ && grep -r 'panels/status' tools/dashboard/frontend/`
Expected: No matches (main.ts already uses Preact components)

**Step 2: Delete the files**

```bash
rm tools/dashboard/frontend/panels/kanban.ts
rm tools/dashboard/frontend/panels/status.ts
```

**Step 3: Build to verify**

Run: `bun tools/dashboard/build.ts`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A tools/dashboard/frontend/panels/kanban.ts tools/dashboard/frontend/panels/status.ts
git commit -m "chore(dashboard): delete dead legacy kanban and status panels"
```

---

### Task 2: Extract `fmt` and `fmtDuration` → `lib/format.ts`

**Files:**
- Create: `tools/dashboard/frontend/lib/format.ts`
- Modify: `tools/dashboard/frontend/components/StatusBar.ts` (remove local `fmt`/`fmtDuration`, import from `lib/format.ts`)

**Step 1: Create `lib/format.ts`**

```typescript
/**
 * Number and duration formatting helpers for the dashboard UI.
 */

/** Formats large numbers with K/M suffixes (e.g. 1500 → "1.5K"). */
export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Formats seconds into human-readable duration (e.g. 125 → "2m 5s"). */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
```

**Step 2: Update `StatusBar.ts`**

Remove lines 15-28 (local `fmt` and `fmtDuration`). Add import:
```typescript
import { fmt, fmtDuration } from '@dashboard/frontend/lib/format'
```

**Step 3: Build to verify**

Run: `bun tools/dashboard/build.ts`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add tools/dashboard/frontend/lib/format.ts tools/dashboard/frontend/components/StatusBar.ts
git commit -m "refactor(dashboard): extract fmt/fmtDuration to lib/format.ts"
```

---

### Task 3: Extract `getNewIssueActions` → `lib/issue-helpers.ts`

**Files:**
- Create: `tools/dashboard/frontend/lib/issue-helpers.ts`
- Modify: `tools/dashboard/frontend/components/KanbanBoard.ts` (remove local, import)
- Modify: `tools/dashboard/frontend/panels/editor.ts` (replace inline logic with import)

**Step 1: Create `lib/issue-helpers.ts`**

```typescript
/**
 * Shared issue-related helpers for the dashboard frontend.
 */
import type { Issue } from '@dashboard/frontend/lib/types'

/**
 * Returns the available action commands for a NEW issue based on its triage state.
 *
 * - `needs_interview === undefined` → needs triage first
 * - `needs_interview === true` → ready for interview
 * - `needs_interview === false` → no actions (auto-transitions to GROOMED)
 */
export function getNewIssueActions(issue: Issue): string[] {
  if (issue.needs_interview === undefined) return ['triage']
  if (issue.needs_interview === true) return ['interview']
  return []
}
```

**Step 2: Update `KanbanBoard.ts`**

Remove lines 22-26 (local `getNewIssueActions`). Add import:
```typescript
import { getNewIssueActions } from '@dashboard/frontend/lib/issue-helpers'
```

**Step 3: Update `editor.ts`**

Replace the inline block at lines 269-275:
```typescript
// Before (inline):
if (issue.state === 'NEW') {
  if (issue.needs_interview === undefined) actions = ['triage']
  else if (issue.needs_interview === true) actions = ['interview']
  else actions = []
} else {
  actions = CMD_ACTIONS[issue.state] ?? []
}
```
With:
```typescript
import { getNewIssueActions } from '@dashboard/frontend/lib/issue-helpers'
// ...
const actions = issue.state === 'NEW'
  ? getNewIssueActions(issue)
  : (CMD_ACTIONS[issue.state] ?? [])
```

**Step 4: Build to verify**

Run: `bun tools/dashboard/build.ts`

**Step 5: Commit**

```bash
git add tools/dashboard/frontend/lib/issue-helpers.ts tools/dashboard/frontend/components/KanbanBoard.ts tools/dashboard/frontend/panels/editor.ts
git commit -m "refactor(dashboard): extract getNewIssueActions to lib/issue-helpers.ts"
```

---

### Task 4: Extract `contextBarColor` → `lib/constants.ts`

**Files:**
- Modify: `tools/dashboard/frontend/lib/constants.ts` (add `contextBarColor`)
- Modify: `tools/dashboard/frontend/components/KanbanBoard.ts` (remove local, import)

**Step 1: Add to `constants.ts`**

Append after the existing `stateColor` function:
```typescript
/**
 * Returns a red/orange/green colour based on context usage percentage.
 * Used for progress bar fills on kanban cards.
 *
 * @param pct - Context usage percentage (0-100)
 * @returns A CSS hex colour string
 */
export function contextBarColor(pct: number): string {
  if (pct > 80) return '#ef4444'
  if (pct > 60) return '#f97316'
  return '#22c55e'
}
```

**Step 2: Update `KanbanBoard.ts`**

Remove lines 28-32 (local `contextBarColor`). Add to existing import:
```typescript
import { ..., contextBarColor } from '@dashboard/frontend/lib/constants'
```

**Step 3: Build to verify**

Run: `bun tools/dashboard/build.ts`

**Step 4: Commit**

```bash
git add tools/dashboard/frontend/lib/constants.ts tools/dashboard/frontend/components/KanbanBoard.ts
git commit -m "refactor(dashboard): move contextBarColor to lib/constants.ts"
```

---

### Task 5: Extract `VALID_TRANSITIONS` → `lib/transitions.ts`

The editor currently redeclares `VALID_TRANSITIONS` locally (`editor.ts:31-40`). The server source of truth is `src/core/issue/index.ts:20-29`. They are identical. Create a shared frontend copy that's the single source for the dashboard.

**Files:**
- Create: `tools/dashboard/frontend/lib/transitions.ts`
- Modify: `tools/dashboard/frontend/panels/editor.ts` (remove local, import)

**Step 1: Create `lib/transitions.ts`**

```typescript
/**
 * Valid state transitions for the dashboard frontend.
 *
 * Mirrors the server-side {@link VALID_TRANSITIONS} in `src/core/issue/index.ts`.
 * If the server transitions change, this must be updated to match.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['GROOMED', 'STUCK'],
  GROOMED: ['PLANNED', 'STUCK', 'SPLIT'],
  PLANNED: ['IN_PROGRESS', 'STUCK', 'SPLIT'],
  IN_PROGRESS: ['COMPLETED', 'STUCK', 'SPLIT'],
  STUCK: ['PLANNED', 'NEW', 'GROOMED', 'SPLIT'],
  SPLIT: [],
  COMPLETED: ['VERIFIED'],
  VERIFIED: [],
}
```

**Step 2: Update `editor.ts`**

Remove lines 31-40 (local `VALID_TRANSITIONS`). Add import:
```typescript
import { VALID_TRANSITIONS } from '@dashboard/frontend/lib/transitions'
```

**Step 3: Build to verify**

Run: `bun tools/dashboard/build.ts`

**Step 4: Commit**

```bash
git add tools/dashboard/frontend/lib/transitions.ts tools/dashboard/frontend/panels/editor.ts
git commit -m "refactor(dashboard): extract VALID_TRANSITIONS to lib/transitions.ts"
```

---

## Verification

1. `bun tools/dashboard/build.ts` — full build succeeds with no errors
2. `grep -rn 'getNewIssueActions' tools/dashboard/frontend/` — only in `lib/issue-helpers.ts` and imports
3. `grep -rn 'function fmt\b' tools/dashboard/frontend/` — only in `lib/format.ts`
4. `grep -rn 'contextBarColor' tools/dashboard/frontend/` — only in `lib/constants.ts` and imports
5. `grep -rn 'VALID_TRANSITIONS' tools/dashboard/frontend/` — only in `lib/transitions.ts` and imports
6. Start dashboard (`bun tools/dashboard/server.ts`) and visually verify kanban, status bar, and editor all render correctly

## Plan file

Save to: `resources/plans/044-dashboard-component-reusability.md`
