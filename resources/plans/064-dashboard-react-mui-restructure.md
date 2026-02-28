# Dashboard Restructure: Preact → React + MUI

## Context

The dashboard (`tools/dashboard/frontend/`) is currently built on Preact + @preact/signals + htm tagged templates + DaisyUI/Tailwind. While functional, this stack limits access to React's richer ecosystem (testing, dev tools, libraries), MUI's comprehensive component library, and consistent design system. This restructure is a **full rewrite** of the frontend — the backend API remains unchanged.

**Goals:** Richer UI components, better ecosystem coverage, design consistency via MUI, stronger DRY through reusable domain components, feature-based architecture.

---

## Technology Stack

| Current | New |
|---------|-----|
| Preact | React 19 |
| @preact/signals | Zustand |
| htm tagged templates | JSX/TSX |
| DaisyUI + Tailwind | MUI v6 + Emotion |
| Custom CSS vars | MUI theme system |

---

## Directory Structure

```
tools/dashboard/frontend/
├── main.tsx                        # React root, polling setup
├── App.tsx                         # Grid layout shell, keyboard shortcuts
├── theme.ts                        # MUI theme (palette, typography, state colors)
│
├── common/                         # Shared reusable primitives
│   ├── components/
│   │   ├── StateBadge.tsx          # Issue state chip (color, label, emoji)
│   │   ├── ActionButton.tsx        # Async button with loading state
│   │   ├── RelChip.tsx             # Parent/child navigation chip
│   │   ├── ContextBar.tsx          # Linear progress with color thresholds
│   │   ├── ConfirmDialog.tsx       # Reusable confirmation dialog
│   │   ├── ElapsedTimer.tsx        # Live-updating elapsed time display
│   │   └── EmptyState.tsx          # "No items" placeholder
│   ├── hooks/
│   │   ├── useSSE.ts              # EventSource lifecycle hook
│   │   ├── useWebSocket.ts        # WebSocket lifecycle hook
│   │   ├── usePolling.ts          # Interval-based fetch with enable/disable
│   │   ├── useKeyboardShortcut.ts # Document-level key listener
│   │   └── useResizable.ts        # Drag-to-resize for panels
│   └── utils/
│       ├── api-client.ts           # Fetch wrappers (reuse existing)
│       ├── format.ts               # fmt(), fmtDuration() (reuse existing)
│       └── constants.ts            # STATE_ORDER, STATE_COLORS, CMD_ACTIONS, ICON
│
├── kanban/                         # Kanban board feature
│   ├── KanbanBoard.tsx
│   ├── KanbanColumn.tsx
│   ├── KanbanCard.tsx
│   └── CardActions.tsx
│
├── sidebar/                        # Tabbed sidebar (resizable Drawer)
│   ├── Sidebar.tsx                 # Shell: resize, tabs, open/close
│   ├── SidebarHeader.tsx           # Title + tab bar (Issue | Prompts)
│   ├── issues/                     # Issue detail panel
│   │   ├── IssuePanel.tsx          # Orchestrates sub-tabs (preview/edit/metadata)
│   │   ├── IssuePreview.tsx        # Rendered markdown
│   │   ├── IssueEditor.tsx         # CodeMirror wrapper (lazy mount)
│   │   ├── IssueMetadata.tsx       # JSON frontmatter viewer
│   │   ├── IssueSteps.tsx          # Pipeline progress stepper
│   │   └── IssueActions.tsx        # Save, Run, Delete buttons
│   └── prompts/                    # Prompt template panel (new feature)
│       ├── PromptPanel.tsx         # List + select prompt templates
│       ├── PromptEditor.tsx        # Edit prompt with CodeMirror
│       └── PromptPreview.tsx       # Rendered prompt preview
│
├── activity/                       # Activity panel (bottom)
│   ├── ActivityPanel.tsx           # 3-column layout with StatusBar header
│   ├── StatusBar.tsx               # Stats, filters, active command timer
│   ├── FilterBar.tsx               # Activity kind filter toggles
│   ├── entries/                    # One renderer per entry kind (DRY)
│   │   ├── StdoutGroup.tsx         # Collapsible consecutive stdout
│   │   ├── StderrRow.tsx           # Pino JSON log with severity
│   │   ├── ToolCard.tsx            # Tool call + result display
│   │   ├── TokenRow.tsx            # Token count breakdown
│   │   ├── ErrorBanner.tsx         # Error display
│   │   └── TermLine.tsx            # Synthetic terminal line
│   └── TodoList.tsx                # Collapsible task progress (right column)
│
├── sessions/                       # Session browser (left column of activity)
│   ├── SessionList.tsx             # Active/recent/archived sections
│   └── SessionRow.tsx              # Individual session with controls
│
├── header/                         # App header
│   └── Header.tsx                  # Auto/Stop/New/Profile/Config/Audit buttons
│
├── modals/                         # Shared modals
│   ├── NewIssueModal.tsx           # Create issue dialog
│   ├── InterviewModal.tsx          # Multi-step Q&A dialog
│   └── ConfigPanel.tsx             # Config editor dialog
│
└── store/                          # Zustand stores (domain slices)
    ├── useIssueStore.ts            # issues[], selectedId, runningId, CRUD + commands
    ├── useActivityStore.ts         # entries[], filters, todoItems, panel state
    ├── useSessionStore.ts          # sessions[], selectedSessionId, showArchived
    ├── useUIStore.ts               # modal flags, sidebarTab, pauseRefresh, profiling
    └── useConfigStore.ts           # models, auditGate, fetch/save/trigger
```

---

## Layout

```
┌──────────────────────────────────────────────────┐
│ Header (AppBar)                                   │
├────────────────────────────┬─────────────────────┤
│                            │ Sidebar (Drawer)     │
│ KanbanBoard                │  [Issue] [Prompts]   │
│                            │  ┌─────────────────┐ │
│                            │  │ Content panel    │ │
│                            │  │ (tabbed)         │ │
│                            │  └─────────────────┘ │
├────────────────────────────┴─────────────────────┤
│ ActivityPanel (resizable)                         │
│ ┌─ StatusBar ──────────────────────────────────┐  │
│ │ issue stats │ filters │ elapsed timer        │  │
│ ├─────────┬────────────────────────┬───────────┤  │
│ │Sessions │ Activity entries       │ TodoList  │  │
│ │ (list)  │ (log stream)          │(collapse) │  │
│ └─────────┴────────────────────────┴───────────┘  │
└──────────────────────────────────────────────────┘
```

- Sidebar: horizontally resizable (280–800px)
- ActivityPanel: vertically resizable (100–600px)
- TodoList: collapsible horizontally (right column)

---

## Zustand Store Design

### useIssueStore
```
State: issues[], selectedId, runningId
Actions: fetchIssues, openCard, navigateToIssue, doTransition, deleteIssue, runCommand, stopCommand, runAuto, stopAuto
```

### useActivityStore
```
State: entries[], filters (Set<ActivityKind>), todoItems[], isOpen, title, termInputVisible
Actions: pushEntry, clearLog, setFilter, openPanel, extractTodo, logTerm
Internal: liveEntries[] buffer (trimmed to 5000), toolCallIndex map for result resolution
```

### useSessionStore
```
State: sessions[], selectedSessionId, showArchived
Actions: fetchSessions, selectSession, deselectSession, stopSession, deleteSession, archiveSession, stopAll
```

### useUIStore
```
State: newIssueOpen, configOpen, interviewTarget, sidebarTab, pauseRefresh, profiling
Actions: openNewIssue, closeNewIssue, openConfig, closeConfig, startInterview, endInterview, setSidebarTab, toggleProfiling
```

### useConfigStore
```
State: models, auditGate
Actions: fetchConfig, saveConfig, fetchAuditGate, triggerAuditGate, cancelAuditGate
```

---

## Reusable Components (DRY)

| Component | Current Duplication | Consolidates |
|-----------|-------------------|-------------|
| `StateBadge` | State rendering in KanbanCard, StatusBar, EditorSidebar, SessionRow | Single chip with color/label/emoji from state |
| `ActionButton` | Already exists, migrate to MUI Button | Async onClick + loading spinner |
| `ContextBar` | Inline in KanbanCard + StatusBar | MUI LinearProgress with threshold colors |
| `ElapsedTimer` | Inline in StatusBar + SessionRow | useEffect timer, formats via fmtDuration |
| `ConfirmDialog` | Inline confirms for delete/stop | MUI Dialog with confirm/cancel |
| `EmptyState` | Various "no items" text across components | Consistent empty placeholder |
| `RelChip` | Issue parent/child navigation | Clickable MUI Chip → navigateToIssue |

## Reusable Hooks

| Hook | Replaces | Notes |
|------|----------|-------|
| `useSSE` | SSEClient class + manual EventSource | Returns { data, error, close }; auto-cleanup on unmount |
| `useWebSocket` | WSClient class | Returns { send, lastMessage, close }; auto-cleanup |
| `usePolling` | setInterval in main.tsx | Accepts fn + interval + enabled flag; clears on unmount |
| `useKeyboardShortcut` | document.addEventListener in App | Accepts key + handler; respects input focus |
| `useResizable` | resizer.ts MutationObserver | Returns ref + size; handles mousedown/mousemove/mouseup |

---

## MUI Theme

- **Mode:** Dark (matches current dashboard)
- **Palette:** Map existing `--color-state-*` CSS vars to MUI custom palette entries
- **Typography:** System font for UI, monospace for code/log areas
- **Components:** Override defaults for Card (kanban cards), Chip (badges), Drawer (sidebar), AppBar (header)
- **Spacing:** MUI 8px grid baseline

---

## Build Pipeline Changes

**`tools/dashboard/build.ts` modifications:**
- Entrypoint stays `frontend/main.tsx`
- Remove Tailwind CSS build step (MUI uses Emotion CSS-in-JS)
- Remove DaisyUI, Tailwind deps
- Add: `react`, `react-dom`, `@mui/material`, `@emotion/react`, `@emotion/styled`, `zustand`
- Keep: `codemirror` deps, `marked` (markdown rendering)
- Bun.build JSX config: `jsx: 'react-jsx'`

**`package.json` dependency changes:**
- Remove: `preact`, `@preact/signals`, `@preact/signals-core`, `htm`, `daisyui`, `tailwindcss`, `@tailwindcss/cli`
- Add: `react@^19`, `react-dom@^19`, `@mui/material@^6`, `@mui/icons-material@^6`, `@emotion/react`, `@emotion/styled`, `zustand@^5`

---

## Backend Changes

**None.** The backend (server.ts, routes/, services/) is framework-agnostic. It serves static files from `dist/` and exposes JSON API endpoints. The frontend rewrite consumes the same API.

Only addition: new API endpoint for prompt template CRUD (for the new Prompts sidebar tab):
- `GET /api/prompts` — list prompt template files from promptDir
- `GET /api/prompts/:name` — read prompt file content
- `PUT /api/prompts/:name` — save prompt file content

---

## Implementation Order

This is a large rewrite. Recommended build sequence (each step produces a testable increment):

1. **Foundation** — `package.json` deps, `build.ts` updates, `theme.ts`, `main.tsx`, `App.tsx` shell
2. **Stores** — All 5 Zustand stores with actions (port from signals + actions.ts)
3. **Common components** — StateBadge, ActionButton, ContextBar, ElapsedTimer, ConfirmDialog, EmptyState
4. **Common hooks** — useSSE, useWebSocket, usePolling, useKeyboardShortcut, useResizable
5. **Header** — Header.tsx with Auto/Stop/New/Config/Audit buttons
6. **Kanban** — KanbanBoard, KanbanColumn, KanbanCard, CardActions
7. **Sidebar shell** — Sidebar.tsx, SidebarHeader.tsx with tab switching
8. **Issue panel** — IssuePanel, IssuePreview, IssueEditor, IssueMetadata, IssueSteps, IssueActions
9. **Activity panel** — ActivityPanel, StatusBar, FilterBar, entry renderers, TodoList
10. **Sessions** — SessionList, SessionRow
11. **Modals** — NewIssueModal, InterviewModal, ConfigPanel
12. **Prompts panel** — Backend endpoints + PromptPanel, PromptEditor, PromptPreview
13. **Polish** — Keyboard shortcuts, resize handles, profiling, theme refinement

---

## Verification

1. `bun run dashboard:build` — builds without errors
2. `bun run dashboard:dev` — serves on localhost:3333
3. **Kanban board** — issues render in correct columns, cards clickable
4. **Sidebar** — opens on card click, tabs switch between Issue/Prompts, edit/save works
5. **Commands** — run plan/build/audit from card or sidebar, SSE streams to activity log
6. **Activity panel** — 3-column layout, filters work, todo items tracked, session browser navigable
7. **Modals** — new issue, interview, config all functional
8. **Keyboard shortcuts** — Esc closes, N opens new issue
9. **Existing tests** — `bun test` passes (backend unchanged)
