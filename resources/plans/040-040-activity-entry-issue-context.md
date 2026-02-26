# 040-activity-entry-issue-context

## Context

Each activity record in the dashboard log panel shows tool calls, tokens, stdout, etc. but lacks issue context — users can't tell at a glance *which issue* an entry belongs to. This is especially confusing when reviewing a long log after the fact. The fix: attach `issueId` and `issueName` to every `ActivityEntry` at creation time, and render them as a badge on each row.

## Files to Modify

- `tools/dashboard/frontend/lib/types.ts` — add `issueId?` and `issueName?` to `ActivityEntry`
- `tools/dashboard/services/activity-aggregator.ts` — add same two fields to its local `ActivityEntry` interface
- `tools/dashboard/frontend/main.ts` — inject issue context when building `ActivityEntry` objects
- `tools/dashboard/frontend/panels/activity-log.ts` — render the issue badge on all row types

## Implementation

### 1. Extend `ActivityEntry` (both copies)

```typescript
export interface ActivityEntry {
  timestamp: number
  source: ActivitySource
  kind: ActivityKind
  issueId?: string    // ← add
  issueName?: string  // ← add
  data: Record<string, unknown>
}
```

### 2. Inject issue context in `main.ts`

In `handleMsg()`, the `runningId` variable holds the active issue ID and `issues` holds all loaded issues. Look up the title and attach to every `appendActivity` call:

```typescript
// helper at top of the function (or inline)
const activeIssue = runningId ? issues.find(i => i.id === runningId) : undefined
const issueCtx = activeIssue ? { issueId: activeIssue.id, issueName: activeIssue.title } : {}
```

Spread `issueCtx` into every `ActivityEntry` literal in `handleMsg()`:
```typescript
appendActivity({
  timestamp: Date.now(),
  source: 'command',
  kind: 'stdout',
  ...issueCtx,
  data: { line },
})
```

Also in the JSONL log SSE callback (`logSSE.connect`), wrap the call to inject context:
```typescript
logSSE.connect('/api/issues/' + id + '/logs', (data) => {
  const issue = issues.find(i => i.id === id)
  const entry = data as ActivityEntry
  appendActivity({
    ...entry,
    issueId: entry.issueId ?? id,
    issueName: entry.issueName ?? issue?.title,
  })
})
```

### 3. Render issue badge in `activity-log.ts`

Add a shared helper:
```typescript
function issueSpan(entry: ActivityEntry): HTMLElement | null {
  if (!entry.issueId) return null
  const s = el('span', 'pino-issue-id')
  s.textContent = '#' + entry.issueId + (entry.issueName ? ':' + entry.issueName : '')
  return s
}
```

Insert it into `summaryChildren` arrays (after `timeSpan`, before the badge) in:
- `appendStdoutLine` — in the `<summary>` of the turn-group `<details>`
- `appendToolCard` — in the `<summary>` after `tSpan`
- `updateTokenCounter` — in the `makeDetailsRow` children array
- `appendResultRow` — in the `makeDetailsRow` children array
- `appendErrorBanner` — in the `makeDetailsRow` children array

**Note:** `appendStderrLine` already handles `pino.issueId` for pino-parsed logs; for the non-pino fallback path, also inject from `entry.issueId`.

The `pino-issue-id` CSS class already exists in `activity.css`.

## Verification

1. Run `barf plan --issue NNN` via the dashboard
2. Observe the activity log — every row (stdout turns, tool cards, token rows, result rows) should show `#NNN:IssueName` badge
3. JSONL SDK log entries (tool_call, tool_result, token_update from the stream) should also carry the badge
4. No TypeScript errors: `bun run typecheck` (or equivalent)
