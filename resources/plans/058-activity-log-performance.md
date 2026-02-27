# 058 — Activity log performance / memory leak

## Problem

During long `auto` runs the dashboard accumulates activity entries without bound, eventually crashing the browser tab. Three compounding issues:

1. **Unbounded entry growth** — `liveEntries` array and `activityEntries` signal grow forever. A multi-issue auto run produces tens of thousands of entries with no cap.

2. **O(n) full-array map on every tool_result** — `pushActivity()` (actions.ts:73-93) maps over the entire `liveEntries` AND `activityEntries.value` to find the matching tool_call and attach the result. With 10k+ entries this is expensive and creates GC pressure from the copied arrays.

3. **O(n) useMemos re-run on every push** — `ActivityLog.tsx` has 3 `useMemo` hooks (`agentNames`, `cumulativeTokens`, `grouped`) that iterate the full entries array. Since `activityEntries` gets a new array reference on every single push, all three recompute on every SSE message.

## Solution

### 1. Cap entries at 5,000 (`actions.ts`)

Add `MAX_ACTIVITY_ENTRIES = 5000` constant. After appending to `liveEntries`, trim oldest if over limit:

```ts
const MAX_ACTIVITY_ENTRIES = 5000

// after: liveEntries = [...liveEntries, processed]
if (liveEntries.length > MAX_ACTIVITY_ENTRIES) {
  liveEntries = liveEntries.slice(-MAX_ACTIVITY_ENTRIES)
}
```

### 2. O(1) tool_result resolution via index map (`actions.ts`)

Replace the O(n) `.map()` with a `Map<string, number>` mapping `toolUseId → array index`:

```ts
const toolCallIndex = new Map<string, number>()
```

- On `tool_call` push: record `toolCallIndex.set(toolUseId, liveEntries.length - 1)`
- On `tool_result`: `const idx = toolCallIndex.get(toolUseId)` → direct update at `liveEntries[idx]`
- On `clearActivityLog`: `toolCallIndex.clear()`
- On trim: rebuild map from remaining entries (only when trim occurs, amortised rare)

### 3. No changes to ActivityLog.tsx

The useMemo re-computation is proportional to array size. With the 5k cap and less frequent signal updates from batched tool_results, this stays fast. No changes needed there.

## Files

- `tools/dashboard/frontend/lib/actions.ts` — entry cap + index map

## Verification

1. `bun run dashboard:build` — clean build
2. Run `auto` with multiple issues — monitor Memory tab in DevTools, should plateau
3. Expand tool cards — results still resolve correctly
4. Browse historical sessions — still works (separate code path)
