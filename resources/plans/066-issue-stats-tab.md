# 066 — Issue Stats Tab

## Context

The dashboard's IssuePanel currently has two section tabs: `issue` and `plan`. Users want visibility into how issues progress through the state machine and where resources (tokens, time, iterations) are spent. The stage log data already exists in each issue's body markdown — we just need to parse and visualize it.

## Design

Add a **`stats`** top-level section tab to the IssuePanel. Read-only, no sub-tabs. Two visual sections:

### 1. Summary Cards
Row of stat cards from issue frontmatter:
- **Runs** (`run_count`)
- **Duration** (`total_duration_seconds`) — formatted as `Xm Ys`
- **Input tokens** (`total_input_tokens`) — formatted with K/M suffixes
- **Output tokens** (`total_output_tokens`)
- **Iterations** (`total_iterations`)

### 2. Stage Timeline with CSS Bar Charts
Vertical list of stage transitions parsed from `## Stage Log` in the issue body. Each entry shows:
- State badge (colored dot + label)
- Timestamp
- Duration bar — horizontal CSS bar, proportional width
- Token bars — input vs output, proportional width
- Context usage — progress bar colored by level
- Meta line — model, trigger, iterations

### UI Mockup
```
┌─────────────────────────────────────────┐
│  [issue]  [plan]  [stats]               │
├─────────────────────────────────────────┤
│  Runs  Duration  In Tokens  Out  Iters  │
│   3     4m 5s     12.4k    8.2k   14    │
├─────────────────────────────────────────┤
│  ● GROOMED         12:04:30 Mar 1       │
│    Duration  ████████░░░░░░░░  42s      │
│    Tokens    ██████░░░  2.1k in         │
│              ████░░░░░  1.4k out        │
│    Context   ████████████░░░░  45%      │
│    sonnet · auto/triage · 3 iters       │
│                                         │
│  ● PLANNED          12:05:12 Mar 1      │
│    Duration  ████████████████  85s      │
│    Tokens    ████████████░░░  5.2k in   │
│              ██████████░░░░░  3.8k out  │
│    Context   █████████████████████ 72%  │
│    sonnet · auto/plan · 6 iters         │
└─────────────────────────────────────────┘
```

## Files

### New
- `tools/dashboard/frontend/components/StatsPanel.tsx`

### Modified
- `tools/dashboard/frontend/components/IssuePanel.tsx` — add `stats` section tab + render StatsPanel
- `tools/dashboard/frontend/lib/constants.ts` — bar color constants if needed

### Reuse
- `stateColor()`, `STATE_LABELS`, `STATE_EMOJI` from constants.ts
- `StageLogEntry` type from `@/types/schema/session-stats-schema.ts`
- DaisyUI `stat`, `progress` components

## Verification
1. `bun run dashboard:build` compiles
2. Issue with stage log → stats tab shows summary + timeline
3. Issue without stage log → empty state
4. `bun test` passes
