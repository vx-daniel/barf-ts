# Dashboard Imperative → Preact Component Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert all remaining imperative DOM panels and inline event wiring to reactive Preact JSX components, completing the migration started with KanbanBoard and StatusBar.

**Architecture:** Each imperative panel becomes a self-contained `.tsx` component reading signals from `lib/state.ts`. New signals are added where needed (modal open/close state, activity log entries). The `index.html` template is stripped of static markup that moves into components. `main.tsx` becomes a single `<App />` render.

**Tech Stack:** Preact, @preact/signals, TypeScript JSX, Bun

---

## Preparation

### Task 0: Cleanup — delete dead code

**Files:**
- Delete: `tools/dashboard/frontend/components/KanbanBoard.ts` (old htm version, unused)

```bash
git rm tools/dashboard/frontend/components/KanbanBoard.ts
git commit -m "chore: remove dead KanbanBoard.ts (htm version)"
```

---

## New Signals

### Task 1: Add UI state signals to `lib/state.ts`

**Files:**
- Modify: `tools/dashboard/frontend/lib/state.ts`

Add these signals for modal/panel open state and activity log data:

```ts
import type { ActivityEntry } from '@dashboard/frontend/lib/types'

/** Whether the new-issue modal is open. */
export const newIssueOpen = signal(false)

/** Whether the config modal is open. */
export const configOpen = signal(false)

/** Whether the interview modal is open, and for which issue. */
export const interviewTarget = signal<{ issue: Issue; done: () => void } | null>(null)

/** Whether the activity panel is expanded. */
export const activityOpen = signal(false)

/** Activity panel title override. */
export const activityTitle = signal('Activity Log')

/** Whether the terminal input row is visible (interview mode). */
export const termInputVisible = signal(false)
```

**Commit** after this task.

---

## Modal Components

### Task 2: Create `<NewIssueModal />`

**Files:**
- Create: `tools/dashboard/frontend/components/NewIssueModal.tsx`

Replaces: inline DOM wiring in `main.tsx` lines 92-118, and the `#modal-ov` block in `index.html` lines 67-79.

Component reads `newIssueOpen` signal. Internal state: `title`, `body` via `useState`. On submit, calls `api.createIssue()` then `fetchIssues()`, closes modal. Escape key handled by parent `<App />`.

```tsx
import { useState, useEffect, useRef } from 'preact/hooks'
import { newIssueOpen } from '@dashboard/frontend/lib/state'
import * as api from '@dashboard/frontend/lib/api-client'
import { fetchIssues } from '@dashboard/frontend/lib/actions'

export function NewIssueModal() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const open = newIssueOpen.value

  useEffect(() => {
    if (open) {
      setTitle('')
      setBody('')
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  async function submit() {
    const t = title.trim()
    if (!t) { titleRef.current?.focus(); return }
    try {
      await api.createIssue(t, body.trim() || undefined)
      newIssueOpen.value = false
      await fetchIssues()
    } catch (e) { /* termLog error */ }
  }

  return (
    <div id="modal-ov" className="open" onClick={...}>
      <div id="modal">
        <h2>New Issue</h2>
        ...form fields reading title/body state...
        <div id="modal-btns">
          <button type="button" className="mbtn" onClick={() => newIssueOpen.value = false}>Cancel</button>
          <button type="button" className="mbtn primary" onClick={() => void submit()}>Create</button>
        </div>
      </div>
    </div>
  )
}
```

Remove the `#modal-ov` block from `index.html`. Remove the modal wiring from `main.tsx`.

**Commit.**

---

### Task 3: Create `<InterviewModal />`

**Files:**
- Create: `tools/dashboard/frontend/components/InterviewModal.tsx`
- Eventually delete: `tools/dashboard/frontend/panels/interview-modal.ts`

Replaces: `panels/interview-modal.ts` entirely.

State: `currentIdx`, `questions`, `answers` via `useState`. Reads `interviewTarget` signal. Move `parseQuestionsFromBody()` into `lib/issue-helpers.ts`.

Key behavior to preserve:
- Radio options with "Other" text input
- Back/Next/Submit buttons
- `api.submitInterview()` call with `more_questions` loop
- Error display

Remove `#interview-ov` block from `index.html`.

**Commit.**

---

### Task 4: Create `<ConfigPanel />`

**Files:**
- Create: `tools/dashboard/frontend/components/ConfigPanel.tsx`
- Eventually delete: `tools/dashboard/frontend/panels/config.ts`

Replaces: `panels/config.ts` entirely.

The `FIELDS` array and field rendering logic move into the component. Reads `configOpen` signal. Internal state: `configData`, `status` message, `saving` boolean.

Key behavior to preserve:
- Fetches config on open via `api.fetchConfig()`
- Grouped field rendering (headings per group)
- Input types: text, number, select, boolean (checkbox), password
- `fixCommands` comma-split handling
- Password masking ("leave blank to keep")
- Save → `api.saveConfig()` → success toast → auto-close

Remove `#config-ov` block from `index.html`.

**Commit.**

---

## Header Component

### Task 5: Create `<Header />`

**Files:**
- Create: `tools/dashboard/frontend/components/Header.tsx`

Replaces: `#header` block in `index.html` (lines 16-22) and Auto button wiring in `main.tsx` + `setAutoBtn()` in `actions.ts`.

Reads `runningId` signal to toggle Auto button between "▶ Auto" / "■ Stop". Opens `newIssueOpen` and `configOpen` signals on button clicks.

Remove `setAutoBtn()` from `actions.ts` and the `autoBtn` module-level reference. The Auto button state is now derived from `runningId.value`.

Remove `#header` from `index.html`.

**Commit.**

---

## Editor Sidebar

### Task 6: Create `<EditorSidebar />`

**Files:**
- Create: `tools/dashboard/frontend/components/EditorSidebar.tsx`
- Eventually delete: `tools/dashboard/frontend/panels/editor.ts`

Replaces: `panels/editor.ts` entirely. Most complex conversion.

Structure:
```
<EditorSidebar />
  ├── Header: #id, title, close button
  ├── State row: state label + transition buttons
  ├── Relationships: parent/children chips (clickable → navigateToIssue)
  ├── Tabs: Preview | Edit | Metadata
  ├── Content area:
  │   ├── Preview: marked HTML (safeRenderHTML via useRef)
  │   ├── Edit: CodeMirror (useRef + useEffect lifecycle)
  │   └── Metadata: JSON syntax highlighting
  └── Actions: Save, Run commands, Stop, Delete
```

Reads signals: `selectedId`, `issues`, `runningId`.

**CodeMirror handling:** `useRef` for container, `useEffect` to mount/destroy EditorView when issue changes. `_dirty` → `useState`.

Key functions to preserve:
- `sanitizeDoc()` / `safeRenderHTML()` — keep as utilities in component file
- `renderMetadataJSON()` — keep inline
- `buildRelChip()` → `<RelChip />` sub-component
- `mountCodeMirror()` → `useEffect`

The `EditorCallbacks` interface is no longer needed — component imports actions directly.

Remove `#sidebar` interior HTML from `index.html` (keep container div or move entirely into component).

**Commit.**

---

## Activity Log

### Task 7: Create `<ActivityLog />`

**Files:**
- Create: `tools/dashboard/frontend/components/ActivityLog.tsx`
- Eventually delete: `tools/dashboard/frontend/panels/activity-log.ts`

Hardest conversion. Current approach: imperative DOM appending with `pendingToolCards` map.

**Approach — data-driven model:**

1. Add signal `activityEntries = signal<ProcessedEntry[]>([])` to `state.ts`
2. `appendActivity()` → signal push: `activityEntries.value = [...activityEntries.value, processEntry(entry)]`
3. `clearLog()` → `activityEntries.value = []`
4. Tool result resolution: tool_result entries find matching tool_call by `toolUseId` and update via immutable array update

**ProcessedEntry type** (add to `types.ts`):
```ts
interface ProcessedEntry {
  key: string
  kind: ActivityKind
  timestamp: number
  issueId?: string
  issueName?: string
  data: Record<string, unknown>
  toolResult?: { content: string; isError: boolean }
}
```

**Stdout grouping:** Compute groups at render time via `useMemo`. Consecutive stdout entries (without intervening non-stdout) form a group.

**Sub-components:**
- `<StdoutGroup />` — collapsible `<details>` with line count summary
- `<StderrRow />` — pino log parser + display
- `<ToolCard />` — tool call with args JSON + pending/resolved result
- `<TokenRow />` — inline token delta display
- `<ResultRow />` / `<ErrorBanner />`
- `<FilterBar />` — filter buttons with local `activeFilters` state

**Scroll-to-bottom:** `useRef` on log container + `useEffect` that scrolls after entries change.

**Cumulative tokens:** Derive from entries via `useMemo` — sum all `token_update` entry data.

**Terminal input row:** Reads `termInputVisible` signal, Enter key → `wsClient.send()`.

Reads: `activityEntries`, `activityOpen`, `activityTitle`, `termInputVisible` signals.

Remove `#bottom` contents from `index.html`.

**Commit.**

---

## Refactor actions.ts

### Task 8: Update `actions.ts` to use signals instead of DOM

**Files:**
- Modify: `tools/dashboard/frontend/lib/actions.ts`

Changes:
1. Replace `appendActivity()` calls → push to `activityEntries` signal
2. Replace `clearLog()` → `activityEntries.value = []`
3. Replace `setTermInput(show)` → `termInputVisible.value = show`
4. Replace `openActivityPanel(title)` → `activityOpen.value = true; activityTitle.value = title`
5. Replace `closeActivityPanel()` → `activityOpen.value = false`
6. Replace `termLog(type, text)` → push synthetic entry to `activityEntries`
7. Remove `setAutoBtn()` and `autoBtn` ref — Header derives from `runningId`
8. Remove `openIssue` / `closeSidebar` imports — EditorSidebar is signal-driven
9. `submitNewIssue` reads from signal state or becomes unnecessary (component calls `api` directly)
10. Remove `refreshSidebar()` — components react to signal changes automatically

**Commit.**

---

## Wire Everything Together

### Task 9: Create `<App />` root component, slim down `main.tsx` and `index.html`

**Files:**
- Create: `tools/dashboard/frontend/components/App.tsx`
- Modify: `tools/dashboard/frontend/main.tsx`
- Modify: `tools/dashboard/frontend/index.html`

`<App />` composes all components and handles global keyboard shortcuts:

```tsx
export function App() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (configOpen.value) { configOpen.value = false; return }
        if (newIssueOpen.value) { newIssueOpen.value = false; return }
        if (selectedId.value) { selectedId.value = null; return }
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey
          && document.activeElement === document.body) {
        newIssueOpen.value = true
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Header />
      <StatusBar />
      <div id="main"><div id="board-wrap"><KanbanBoard /></div></div>
      <EditorSidebar />
      <ActivityLog />
      <NewIssueModal />
      <InterviewModal />
      <ConfigPanel />
    </>
  )
}
```

`main.tsx` becomes ~15 lines: render `<App />`, mount resizers, start polling, initial fetches.

`index.html` body becomes:
```html
<div id="app"></div>
<script type="module" src="./main.tsx"></script>
```

**Commit.**

---

### Task 10: Delete dead imperative panel files

**Files:**
- Delete: `tools/dashboard/frontend/panels/editor.ts`
- Delete: `tools/dashboard/frontend/panels/config.ts`
- Delete: `tools/dashboard/frontend/panels/interview-modal.ts`
- Delete: `tools/dashboard/frontend/panels/activity-log.ts`
- Delete: `tools/dashboard/frontend/panels/` directory if empty

Verify no remaining imports reference deleted files.

**Commit.**

---

## Verification

### Task 11: Build + lint + verify

```bash
bun tools/dashboard/build.ts          # Build passes
bun x @biomejs/biome lint             # No errors
bun x @biomejs/biome format --check   # No format issues
```

Manual verification checklist:
1. Dashboard loads in browser
2. Kanban board renders issues
3. Click card → sidebar opens with preview/edit/metadata tabs
4. Transition buttons work
5. Run command → activity log opens, streams output
6. Auto button toggles between ▶/■ states
7. New Issue modal opens/closes, creates issue
8. Config modal opens, shows form, saves
9. Escape key closes modals/sidebar in correct order
10. `n` shortcut opens new issue modal
11. Activity log filters work
12. Tool cards show args, resolve with results

**Final commit with any fixups.**
