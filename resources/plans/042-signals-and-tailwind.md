# 042-signals-and-tailwind

## Context

The dashboard frontend has two brittleness problems:
1. **State** — five `let` globals in `main.ts` are mutated in 15+ scattered places. Every state change requires manually calling `refreshBoard()`, `updateSummary()`, `updateStatus()` etc. in the right order.
2. **Styling** — five hand-written CSS files with no utility system, making it slow to style new elements.

The fix: `@preact/signals-core` for reactive state (effects auto-propagate changes) and Tailwind CSS v4 for utility-first styling. No JSX, no component rewrite — the existing vanilla DOM panel code stays.

---

## Part 1: Signals

### Install

```bash
bun add @preact/signals-core
```

### What changes in `tools/dashboard/frontend/main.ts`

Replace the five module globals with signals:

```ts
// BEFORE
let issues: Issue[] = []
let selectedId: string | null = null
let runningId: string | null = null
let pauseRefresh = false
let models: Record<string, string> | null = null

// AFTER
import { signal, effect, computed } from '@preact/signals-core'
const issues = signal<Issue[]>([])
const selectedId = signal<string | null>(null)
const runningId = signal<string | null>(null)
const pauseRefresh = signal(false)
const models = signal<Record<string, string> | null>(null)
```

Register three effects right after signal declarations — these replace all manual `refreshBoard()` / `updateSummary()` / `updateStatus()` call sites:

```ts
// Board auto-renders whenever issues or runningId changes
effect(() => {
  renderBoard(getEl('board'), issues.value, {
    onCardClick: openCard,
    onRunCommand: runCommand,
    runningId: runningId.value,
  })
})

// Summary bar auto-updates on any issue list change
effect(() => {
  updateSummary(issues.value)
})

// Status bar auto-updates when selection or issue data changes
effect(() => {
  const selected = issues.value.find((i) => i.id === selectedId.value) ?? null
  updateStatus(selected, models.value ?? undefined)
})
```

### What gets simplified

With effects in place, all explicit `refreshBoard()`, `updateSummary()`, `updateStatus()` calls throughout `main.ts` are **deleted** — mutations to signals trigger them automatically:

| Before | After |
|--------|-------|
| `runningId = null; refreshBoard(); updateSummary(issues)` | `runningId.value = null` |
| `issues = await api.fetchIssues(); refreshBoard(); updateSummary(issues)` | `issues.value = await api.fetchIssues()` |
| `selectedId = issue.id; updateStatus(issue, models)` | `selectedId.value = issue.id` |
| `pauseRefresh = true; runningId = id; refreshBoard()` | `pauseRefresh.value = true; runningId.value = id` |

Functions that are simplified:
- `fetchIssues()` — just sets `issues.value`, no explicit refresh calls
- `openCard()` — just sets `selectedId.value`
- `onCommandDone()` — just resets signal values
- `stopAndReset()` — just resets signal values
- `runCommand()` — just sets `runningId.value` and `pauseRefresh.value`
- All `stopActive*` functions — just reset signal values

### Polling loop

The setInterval check reads `pauseRefresh.value` — no change to structure, just `.value` access:

```ts
refreshInterval = setInterval(() => {
  if (!pauseRefresh.value) void fetchIssues()
}, 5000)
```

### Panel files — no changes needed

`renderBoard`, `updateSummary`, `updateStatus`, `setActiveCommand` etc. keep their existing function signatures. Signals live only in `main.ts`; panels remain pure functions that accept data and mutate DOM.

---

## Part 2: Tailwind CSS v4

### Install

```bash
bun add -d tailwindcss @tailwindcss/cli
```

### New CSS entry point

Create `tools/dashboard/frontend/styles/index.css`:

```css
@import "tailwindcss";

/* Existing custom CSS files, imported in order */
@import "./base.css";
@import "./kanban.css";
@import "./editor.css";
@import "./status.css";
@import "./activity.css";
```

Tailwind v4 auto-scans all files referenced by the entry point's location for utility classes — no `content` array needed.

### Update `tools/dashboard/build.ts`

Replace the manual CSS concatenation block:

```ts
// BEFORE: manual concat
const cssFiles = ['base.css', 'kanban.css', 'editor.css', 'status.css', 'activity.css']
const cssContent = cssFiles
  .map((f) => readFileSync(join(FRONTEND, 'styles', f), 'utf8'))
  .join('\n')
writeFileSync(join(DIST, 'styles.css'), cssContent)

// AFTER: Tailwind CLI handles it
import { spawnSync } from 'bun'
const tw = spawnSync([
  'bunx', '@tailwindcss/cli',
  '-i', join(FRONTEND, 'styles', 'index.css'),
  '-o', join(DIST, 'styles.css'),
  '--minify',
], { stdout: 'inherit', stderr: 'inherit' })
if (tw.exitCode !== 0) throw new Error('Tailwind build failed')
```

The HTML rewrite in build.ts already injects a single `/styles.css` link, so no HTML changes are needed.

### Using Tailwind in panel files

Going forward, Tailwind utility classes can be added directly to `el()` calls:

```ts
// existing el() helper accepts a class string — Tailwind classes work as-is
const badge = el('span', 'text-xs font-mono px-2 py-0.5 rounded-full')
```

The existing custom CSS (variables, kanban grid, CodeMirror theme) is preserved and layered on top of Tailwind's reset via the `@import` chain.

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `tools/dashboard/frontend/main.ts` | Replace 5 globals with signals; register 3 effects; remove all manual refresh calls |
| `tools/dashboard/build.ts` | Replace manual CSS concat with `@tailwindcss/cli` invocation |
| `tools/dashboard/frontend/styles/index.css` | **New** — Tailwind entry point that `@import`s existing CSS files |
| `package.json` | Add `@preact/signals-core` + `tailwindcss` + `@tailwindcss/cli` |

Panel files (`kanban.ts`, `status.ts`, `editor.ts`, `activity-log.ts`, etc.) are **not changed** — they remain pure render functions.

---

## Verification

1. `bun add @preact/signals-core && bun add -d tailwindcss @tailwindcss/cli`
2. `bun run dashboard:build` — should succeed with Tailwind output logged
3. `bun run dashboard` — open browser, confirm board renders, 5s poll refreshes without flicker
4. Start a command run — confirm `runningId` change causes board to re-render (running card highlighted) without explicit call
5. Stop the command — confirm board and status bar update automatically
6. Open DevTools → Network — confirm single `styles.css` request loads correctly
7. `bun run tsc --noEmit 2>&1 | grep dashboard` — zero errors
