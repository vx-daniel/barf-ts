# Session Stats Tracking

## Context

After each barf run (plan/build/split), we want to record stats on the issue: duration, tokens in/out, context size, iterations, and model. Cumulative totals go in frontmatter; per-run history is appended to the issue body.

The SDK already provides `usage.output_tokens` on each assistant message — we just aren't capturing it yet.

## Changes

### 1. Extend `IterationResult` with `outputTokens`

**File:** `src/types/schema/claude-schema.ts`

- Add `outputTokens: z.number()` to `IterationResultSchema`

### 2. Capture output tokens in `consumeSDKQuery`

**File:** `src/core/claude.ts`

- Add `let lastOutputTokens = 0` (line ~94)
- In the `parent_tool_use_id === null` block (line 129), capture `usage.output_tokens ?? 0` — take the max like we do for input tokens (SDK reports cumulative per-iteration)
- Include `outputTokens: lastOutputTokens` in all return paths (lines 168, 177, 187, 189, 192)

### 3. Add cumulative stats fields to `IssueSchema`

**File:** `src/types/index.ts`

Add after `verify_exhausted` (line 70):
```typescript
total_input_tokens: z.number().nonnegative().default(0),
total_output_tokens: z.number().nonnegative().default(0),
total_duration_seconds: z.number().nonnegative().default(0),
total_iterations: z.number().int().nonnegative().default(0),
run_count: z.number().int().nonnegative().default(0),
```

### 4. Update `parseIssue` / `serializeIssue`

**File:** `src/core/issue/index.ts`

**parseIssue:** Add numeric parsing for the 5 new fields (same pattern as `verify_count`).

**serializeIssue:** Always emit the 5 fields (they default to 0, so always present).

### 5. Create `SessionStats` type and formatter

**File:** `src/types/schema/session-stats-schema.ts` (NEW)

```typescript
export const SessionStatsSchema = z.object({
  startedAt: z.string().datetime(),
  durationSeconds: z.number().nonnegative(),
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  finalContextSize: z.number().nonnegative(),
  iterations: z.number().int().nonnegative(),
  model: z.string(),
})
export type SessionStats = z.infer<typeof SessionStatsSchema>

export function formatSessionStatsBlock(stats: SessionStats): string { ... }
```

Formats a markdown block like:
```
---
### Run Stats — 2026-02-25 14:30:00
- **Duration:** 245s
- **Input tokens:** 150,000 (final context: 150,000)
- **Output tokens:** 12,000
- **Iterations:** 3
- **Model:** claude-sonnet-4-6
```

### 6. Accumulate and persist stats in `runLoopImpl`

**File:** `src/core/batch.ts`

**Before the loop** (after line 119):
```typescript
const sessionStartTime = Date.now()
let totalInputTokens = 0
let totalOutputTokens = 0
let lastContextSize = 0
```

**After each iteration result** (line 211):
- Accumulate: `totalInputTokens += tokens; totalOutputTokens += outputTokens; lastContextSize = tokens`

**In `finally` block** (line 321), before `unlockIssue`:
- Compute duration, build `SessionStats`, fetch issue, call `writeIssue` with cumulative totals + appended body
- Wrap in try/catch so stats failure doesn't prevent unlock

**Split early-return** (line 224-226): Move stats persistence to `finally` so it covers both paths.

### 7. Re-export from barrel

**File:** `src/types/index.ts` — re-export `SessionStats`, `SessionStatsSchema`, `formatSessionStatsBlock`

### 8. Update tests

- `tests/unit/core/claude.test.ts` — add `outputTokens` to mock `IterationResult` objects
- `tests/unit/core/issue/index.test.ts` — round-trip test with stats fields
- `tests/unit/core/batch.test.ts` — verify `writeIssue` called with stats after loop
- New: unit test for `formatSessionStatsBlock`

## Key files

- `src/types/schema/claude-schema.ts` — IterationResult
- `src/core/claude.ts` — consumeSDKQuery
- `src/types/index.ts` — IssueSchema
- `src/core/issue/index.ts` — parseIssue/serializeIssue
- `src/types/schema/session-stats-schema.ts` — NEW
- `src/core/batch.ts` — runLoopImpl

## Migration

None needed — new fields default to 0, existing issues parse cleanly.

## Verification

1. `bun test` — all existing tests pass with `outputTokens` added
2. `bun run build` — type-checks clean
3. Manual: `barf plan --cwd tests/sample-project --issue 001`, then inspect issue file for stats in frontmatter and body
