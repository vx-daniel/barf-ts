# 063: Activity Panel Todo List

## Context

When barf runs Claude Agent SDK commands (plan/build/split), Claude often uses `TaskCreate`/`TaskUpdate` tools to track its own progress. These tool calls already appear in the activity log as generic tool cards, but they're buried among hundreds of other entries. Users want at-a-glance visibility into Claude's self-reported task progress without scrolling through the full log.

**Goal:** Extract `TaskCreate`/`TaskUpdate`/`TodoWrite` tool calls from the SDK stream and render them as a compact, collapsible progress bar + checklist in the activity panel.

## Design

### Data Model

New `TodoItem` type and `todoItems` signal:

```typescript
// types.ts
interface TodoItem {
  id: string           // TaskCreate's returned task ID (from tool_result)
  subject: string      // Task title
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string  // Present-tense label shown when in_progress
}

// state.ts
export const todoItems = signal<TodoItem[]>([])
```

### Extraction Logic (actions.ts)

In `pushActivity()`, after the existing tool_call index logic (~line 131), intercept task-related tool calls:

```
if entry.kind === 'tool_call' && entry.data.tool matches TaskCreate/TaskUpdate/TodoWrite:
  - TaskCreate: parse args.subject, args.description → append new TodoItem (pending)
  - TaskUpdate: parse args.taskId, args.status → update matching item
  - TodoWrite: parse args (array of tasks) → replace all items
  → update todoItems signal
```

Also handle `TodoWrite` which is an older tool that writes complete task lists.

Clear `todoItems.value = []` alongside `liveEntries = []` in the reset block of `runCommand()`.

### TodoList Component

New `components/TodoList.tsx` — renders between the filter bar and log content in `ActivityLog.tsx`.

**Collapsed (default when tasks exist):**
```
▸ Tasks: ████████░░░░ 3/7  [⟳ Fix auth error handling]
```
- Progress bar: completed/total ratio
- Shows the `activeForm` of the current `in_progress` task
- Click to expand

**Expanded:**
```
▾ Tasks: ████████░░░░ 3/7
 ✓ Set up test fixtures
 ✓ Implement auth middleware
 ✓ Add JWT validation
 ⟳ Fix auth error handling
 ○ Add rate limiting
 ○ Write integration tests
 ○ Update API docs
```

**Hidden** when `todoItems` is empty (no tasks created yet).

**Styling:** DaisyUI/Tailwind, consistent with existing panel styling. Status icons: `✓` green for completed, `⟳` amber spinning for in_progress, `○` gray for pending.

### Implementation Steps

#### Step 1: Add `TodoItem` type (`types.ts` ~line 34)

```typescript
export interface TodoItem {
  id: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}
```

#### Step 2: Add `todoItems` signal (`state.ts` ~line 63)

```typescript
export const todoItems = signal<TodoItem[]>([])
```

#### Step 3: Extraction logic in `actions.ts`

**a)** Import `todoItems` from state (line ~16).

**b)** Add `extractTodoFromToolCall()` helper after `pushActivity()` (~line 138):

```typescript
const TASK_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TodoWrite'])

function extractTodoFromToolCall(entry: ActivityEntry): void {
  if (entry.kind !== 'tool_call') return
  const tool = entry.data.tool as string
  if (!TASK_TOOLS.has(tool)) return
  const args = entry.data.args as Record<string, unknown> | undefined
  if (!args) return

  if (tool === 'TaskCreate') {
    const subject = String(args.subject ?? '')
    if (!subject) return
    const id = (entry.data.toolUseId as string) ?? `tmp-${Date.now()}`
    // Dedupe by subject
    if (todoItems.value.some(t => t.subject === subject)) return
    todoItems.value = [...todoItems.value, {
      id, subject, status: 'pending',
      activeForm: args.activeForm as string | undefined,
    }]
  } else if (tool === 'TaskUpdate') {
    const taskId = String(args.taskId ?? '')
    const status = args.status as string | undefined
    if (!taskId || !status) return
    if (!['pending', 'in_progress', 'completed'].includes(status)) return
    todoItems.value = todoItems.value.map(t =>
      t.id === taskId ? { ...t, status: status as TodoItem['status'] } : t
    )
  } else if (tool === 'TodoWrite') {
    // TodoWrite replaces the full list — args contains task array
    // Parse whatever structure TodoWrite uses
  }
}
```

**c)** Call `extractTodoFromToolCall(entry)` inside `pushActivity()` after the tool_call index block (after line 134).

**d)** Clear in `clearActivityLog()` (line 161): add `todoItems.value = []`.

#### Step 4: `TodoList.tsx` component (new file)

Preact component reading `todoItems` signal. Renders:
- Nothing when empty
- Collapsed: single row with progress bar + active task label
- Expanded: full checklist with status icons
- Local `expanded` state via `useState(false)`
- Auto-expand when first item arrives

#### Step 5: Render in `ActivityLog.tsx`

Import `TodoList` and render it inside the right panel div (line ~768), before the scrollable log div:

```tsx
<div className="flex-1 flex flex-col min-w-0">
  <TodoList />   {/* ← insert here */}
  <div ref={logRef} ...>
```

### Edge Cases

- **ID mapping**: `TaskCreate` tool_result contains the assigned ID. The `toolUseId` serves as a temp ID. When `tool_result` resolves for a TaskCreate, we could update the ID — but since `TaskUpdate` uses the *real* task ID (e.g. "1", "2"), we need to map. Simplest: use subject-based matching as fallback when ID doesn't match.
- **TodoWrite**: Bulk replacement tool — parse its args structure when encountered.
- **Session switch**: For historical sessions, derive todos from that session's `activityEntries` via a `useMemo` in the component.

### Files to Modify

1. **`tools/dashboard/frontend/lib/types.ts`** ~line 34 — Add `TodoItem` interface
2. **`tools/dashboard/frontend/lib/state.ts`** ~line 63 — Add `todoItems` signal
3. **`tools/dashboard/frontend/lib/actions.ts`** ~lines 16, 138, 161 — Import signal, add extraction, clear on reset
4. **`tools/dashboard/frontend/components/TodoList.tsx`** — New component
5. **`tools/dashboard/frontend/components/ActivityLog.tsx`** ~line 768 — Import and render `<TodoList />`

## Verification

1. `bun run dashboard:build` — builds without errors
2. Start dashboard, run a `plan` or `build` command on an issue
3. Observe: todo bar appears when Claude creates tasks, updates in real-time
4. Click to expand/collapse the checklist
5. Progress bar reflects completed/total ratio
6. Bar disappears when no tasks exist
7. Starting a new command clears the previous todo list
