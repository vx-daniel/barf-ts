# 052-editor-sidebar-progress-steps

## Context

The EditorSidebar currently shows issue state as a single badge + transition buttons. There's no visual indication of *where* the issue is in its lifecycle. A DaisyUI Steps component would give users an at-a-glance progress indicator showing completed, current, and upcoming stages.

## Design

### The "happy path" pipeline

```
NEW → GROOMED → PLANNED → BUILT → COMPLETE
```

Side-states `STUCK` and `SPLIT` are not part of the linear pipeline — they'll be shown as a special indicator alongside the steps (e.g., a badge or icon on the current step).

### Steps component placement

Insert **between** the header and the existing state/transition row (lines 283–304 of `EditorSidebar.tsx`). The existing state badge + transition buttons remain below for actions; the steps are purely visual progress.

### Rendering logic

Define a constant for the linear pipeline:

```ts
const PIPELINE: IssueState[] = ['NEW', 'GROOMED', 'PLANNED', 'PLANNED', 'BUILT', 'COMPLETE']
```

For each step:
- **Completed** (before current): `step step-primary` — filled connector + circle
- **Current**: `step step-primary` — filled, plus we can use `data-content="●"` or a `step-icon` to highlight
- **Upcoming** (after current): `step` — unfilled/neutral

If the issue is in `STUCK` or `SPLIT`, highlight the step it was in before (or just show all as neutral with a STUCK/SPLIT badge overlay).

### Layout

Use `steps steps-horizontal` with compact sizing. Each step label is the short state name. Apply the state's color via inline `style` on the current step for brand consistency with the existing palette.

### CSS considerations

DaisyUI Steps should work out of the box since the dashboard already uses DaisyUI. May need minor sizing tweaks (`text-xs`, constrained width) to fit the sidebar.

## Files to modify

| File | Change |
|------|--------|
| `tools/dashboard/frontend/components/EditorSidebar.tsx` | Add `IssueSteps` sub-component + render it in sidebar |
| `tools/dashboard/frontend/lib/constants.ts` | Add `PIPELINE_STATES` constant (the 6 linear states) |

## Implementation

### 1. Add `PIPELINE_STATES` to constants.ts

```ts
/** Linear issue lifecycle for progress display (excludes side-states STUCK/SPLIT). */
export const PIPELINE_STATES: readonly IssueState[] = [
  'NEW', 'GROOMED', 'PLANNED', 'BUILT', 'COMPLETE',
]
```

### 2. Add steps section to EditorSidebar.tsx

Insert after the header `</div>` (line 282), before the state row. A local helper component `IssueSteps`:

- Takes `state: IssueState`
- Maps over `PIPELINE_STATES`
- Computes step index of current state (`PIPELINE_STATES.indexOf(state)`)
- For STUCK/SPLIT: index = -1, show all steps neutral + a small badge
- Renders `<ul className="steps steps-horizontal w-full px-2xl py-sm border-b border-neutral shrink-0">`
- Each `<li>` gets `step` + `step-primary` if index <= currentIndex
- Current step gets a subtle visual emphasis (bold text or `data-content="●"`)
- Step labels: short names from `STATE_LABELS`

### 3. Compact styling

- `text-xs` on the `<ul>` for small labels
- May need custom CSS for step circle size if DaisyUI defaults are too large — add to `styles/index.css` if needed

## Verification

1. `bun run dashboard:build` — confirm no build errors
2. Open dashboard, select an issue in each state, verify:
   - Steps show correct progress fill
   - STUCK/SPLIT issues render gracefully
   - Steps don't overflow sidebar width
   - Transition buttons still work below
