# Plan 038: Dashboard Console Unified Timeline Log

## Context

The dashboard activity log panel is difficult to read: raw stdout, structured SDK events,
token updates, and tool calls all render as flat single-line rows with no visual hierarchy.
The user wants a unified timeline that tells the story of what Claude is doing — with
distinct visual treatment for agents, skills, tool calls, stdout groups, and state transitions.

---

## Approach: Unified Chronological Timeline

Single scrollable stream. Each event kind gets distinct visual treatment. Related events
are grouped (stdout lines → collapsible turn group; tool call + its result → single card).
Cumulative token count lives in the panel header — not as per-update inline noise.

---

## Backend Changes

### 1. `tools/dashboard/services/activity-aggregator.ts`

**Enrich `tool_call` with args and ID:**
```typescript
// Current:
data: { tool: name }

// New:
data: {
  tool: name,
  toolUseId: string,          // from msg.id or msg.content_block.id
  args: Record<string, unknown>  // from msg.input or msg.content_block.input
}
```

**Add new `tool_result` ActivityKind:**
- Detect `content_block_start` where `content_block.type === 'tool_result'`
- Also detect top-level `type === 'tool_result'` messages
- Emit:
```typescript
{
  kind: 'tool_result',
  data: {
    toolUseId: string,   // to correlate with tool_call
    content: string,     // truncated result text
    isError: boolean,
  }
}
```

### 2. `tools/dashboard/frontend/lib/types.ts`

Add `tool_result` to `ActivityKind` union. Keep in sync with aggregator types.

---

## Frontend Changes

### 3. `tools/dashboard/frontend/panels/activity-log.ts`

**Module-level state to add:**
- `cumulativeTokens: { input: number; output: number }` — updated on each `token_update`
- `currentStdoutGroup: HTMLElement | null` — the active collapsible stdout container
- `pendingToolCards: Map<string, HTMLElement>` — tool_call cards awaiting their result (keyed by toolUseId)

**`appendActivity()` — dispatch to type renderers:**
```typescript
switch (entry.kind) {
  case 'stdout':    appendStdoutLine(entry); break
  case 'stderr':    appendStderrLine(entry); break
  case 'tool_call': appendToolCard(entry); break
  case 'tool_result': resolveToolCard(entry); break
  case 'token_update': updateTokenCounter(entry); break
  case 'result':    appendResultRow(entry); break
  case 'error':     appendErrorBanner(entry); break
}
```

**Stdout grouping:**
- Consecutive stdout lines accumulate inside a `<details class="turn-group">` element
- New group opened on first stdout after a non-stdout event
- `<summary>` shows: "◦ Claude output · N lines · HH:MM:SS"
- Each line inside: `<span class="gutter-time">HH:MM:SS</span> <span class="line-text">...</span>`
- JSON detection: if `line.trim()` starts with `{` or `[`, try `JSON.parse()` — on success render as `<pre class="json-block">` with `JSON.stringify(parsed, null, 2)`

**Tool cards (`appendToolCard`):**
- `<details class="tool-card [agent-card|skill-card]">` based on tool name
- `<summary>`: icon + tool name + timestamp
  - `Task` tool → class `agent-card`, icon `⚡`, label shows `entry.data.args?.subagent_type`
  - `Skill` tool → class `skill-card`, icon `★`, label shows `entry.data.args?.skill`
  - All others → class `tool-card`, icon `⚙`
- Body: `<pre class="args-json">` with pretty-printed args
- Result slot: placeholder "awaiting result…" replaced when `tool_result` arrives

**`resolveToolCard(entry)`:**
- Look up card in `pendingToolCards` by `entry.data.toolUseId`
- Replace placeholder with result content (truncated to 500 chars, full text in `title` attr)
- Add `data-error` class if `entry.data.isError`

**Token counter:**
- `updateTokenCounter()` adds to `cumulativeTokens`, updates `#activity-title` text:
  `Activity Log · in: 12,430 out: 847`

**State transition detection:**
- In `appendStdoutLine()`, check for `__BARF_STATE__:` prefix
- If found, emit a `<div class="state-banner">→ {STATE}</div>` and skip adding to stdout group

### 4. `tools/dashboard/frontend/styles/activity.css`

New CSS additions:
- `.turn-group` — collapsible stdout container, border-left accent
- `.turn-group summary` — dim text, hover highlight
- `.gutter-time` — monospace, muted color, fixed width
- `.json-block` — syntax-highlighted JSON (manual color coding via CSS, no lib needed)
- `.tool-card`, `.agent-card`, `.skill-card` — card boxes with left-border color coding
  - tool: `#60a5fa` (blue), agent: `#2dd4bf` (teal), skill: `#a78bfa` (purple)
- `.state-banner` — full-width, gold background `#b45309`, bold text
- `.result-row` — subtle green tick row
- `.error-banner` — red background

---

## State Transition Detection

The stdout stream already filters `__BARF_STATS__:` lines (in `main.ts`). Add a parallel
check for `__BARF_STATE__:NEW`, `__BARF_STATE__:IN_PROGRESS`, etc. to emit state banners.

---

## Files Modified

| File | Change |
|------|--------|
| `tools/dashboard/services/activity-aggregator.ts` | Enrich tool_call; add tool_result kind |
| `tools/dashboard/frontend/lib/types.ts` | Add tool_result to ActivityKind |
| `tools/dashboard/frontend/panels/activity-log.ts` | Rewrite appendActivity + renderers |
| `tools/dashboard/frontend/styles/activity.css` | New card/group/banner styles |
| `tools/dashboard/frontend/main.ts` | Check for __BARF_STATE__ prefix in stdout handler |

---

## Verification

1. Run `barf build --issue <id>` via the dashboard and observe the timeline
2. Verify tool cards expand/collapse showing args and result
3. Verify `Task` tool calls render as teal agent cards with subagent_type label
4. Verify `Skill` tool calls render as purple skill cards with skill name
5. Verify stdout groups collapse/expand and JSON lines are pretty-printed
6. Verify cumulative token counter updates in panel header
7. Verify state transition banners appear at correct points
8. Run existing tests: `bun test tests/unit/` — no regressions
