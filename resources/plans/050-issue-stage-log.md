# 050 — Issue Stage Log

## Context

Currently, barf-ts tracks cumulative stats in issue frontmatter (`total_input_tokens`, `run_count`, etc.) and appends "Run Stats" markdown blocks to the issue body after each session. There's no structured record of **when** state transitions happened or what resources were consumed **per stage**. This makes it hard to understand an issue's lifecycle — how long it spent in planning vs building, what model was used at each stage, or what triggered each transition.

This feature adds a **per-transition stage log** to the issue body, replacing the existing Run Stats blocks. Each state change appends a heading block with timestamps, stats, context usage, model, and trigger info.

## Output Format

Each entry in the `## Stage Log` section:

```markdown
### PLANNED — 2026-02-27 14:01:07Z

- **From:** GROOMED
- **Duration in stage:** 12s
- **Input tokens:** 1,500 (final context: 1,200)
- **Output tokens:** 450
- **Iterations:** 1
- **Context used:** 34%
- **Model:** claude-opus-4-6
- **Trigger:** auto/plan
```

## Files to Modify

### 1. New schema: `StageLogEntry`

**File:** `src/types/schema/session-stats-schema.ts`

Add `StageLogEntrySchema` alongside existing `SessionStatsSchema`:

```typescript
export const StageLogEntrySchema = z.object({
  fromState: IssueStateSchema,
  toState: IssueStateSchema,
  timestamp: z.string().datetime(),
  durationInStageSeconds: z.number().nonnegative(),
  inputTokens: z.number().nonnegative(),
  outputTokens: z.number().nonnegative(),
  finalContextSize: z.number().nonnegative(),
  iterations: z.number().int().nonnegative(),
  contextUsagePercent: z.number().int().min(0).max(100).optional(),
  model: z.string(),
  trigger: z.string(),  // e.g. "auto/plan", "auto/build", "manual", "auto/triage", "auto/verify"
})
```

Add `formatStageLogEntry(entry: StageLogEntry): string` — replaces `formatSessionStatsBlock`.

### 2. Extend `IssueProvider.transition()`

**File:** `src/core/issue/base.ts` (line 156)

Change signature to accept optional stage log metadata:

```typescript
transition(
  id: string,
  to: IssueState,
  stageLog?: Omit<StageLogEntry, 'fromState' | 'toState' | 'timestamp'>,
): ResultAsync<Issue, Error>
```

When `stageLog` is provided:
- Build the full `StageLogEntry` (fill in `fromState`, `toState`, `timestamp`)
- Format it with `formatStageLogEntry()`
- Find or create `## Stage Log` section in body
- Append the entry
- Write both state + updated body via `writeIssue`

When `stageLog` is omitted: current behavior (just write state). This preserves backward compatibility for callers that don't have stats (e.g., manual CLI transitions, dashboard API).

### 3. Refactor `persistSessionStats()`

**File:** `src/core/batch/stats.ts`

Remove the body-appending logic from `persistSessionStats`. Instead, it only updates the cumulative frontmatter totals. The stage log entry is now written by the `transition()` call in the outcome handlers.

Keep `persistSessionStats` for the frontmatter accumulation (totals are still useful for quick aggregation without parsing the body).

### 4. Pass stats through outcome handlers

**File:** `src/core/batch/outcomes.ts`

The outcome handlers (`handlePlanComplete`, `handleBuildComplete`, `handleSplitComplete`, etc.) already call `provider.transition()`. Extend these calls to pass the session stats as the `stageLog` parameter.

**File:** `src/core/batch/loop.ts` — `runLoop()` creates `SessionStats` at the end. Pass it to the outcome handler so it can forward to `transition()`.

### 5. Update callers outside batch loop

**Files to check:**
- `src/cli/commands/auto.ts` — calls `transition()` for auto-mode state changes
- `src/core/triage/triage.ts` — calls `transition()` after triage
- `src/core/verification/orchestration.ts` — calls `transition()` after verification
- `tools/dashboard/routes/api.ts` — calls `transition()` from REST API

For non-batch callers (triage, dashboard, manual): pass `stageLog` with zeroed stats but valid `trigger` and `durationInStageSeconds` (elapsed time since issue was last updated, if trackable, or 0).

### 6. Remove `formatSessionStatsBlock`

**File:** `src/types/schema/session-stats-schema.ts`

Delete `formatSessionStatsBlock()` and its tests. Replace all call sites with `formatStageLogEntry()`.

### 7. Re-export from barrel

**File:** `src/types/index.ts`

Export `StageLogEntry`, `StageLogEntrySchema`, `formatStageLogEntry`.

## Tests

- **Unit:** `formatStageLogEntry` — correct markdown output
- **Unit:** `transition()` with stageLog — appends to body, creates `## Stage Log` section if absent, appends under existing section if present
- **Unit:** `transition()` without stageLog — backward-compatible, no body change
- **Unit:** `persistSessionStats` — only updates frontmatter, does not touch body
- **Unit:** Round-trip: `parseIssue(serializeIssue(issue))` still works with stage log in body
- **Integration:** Full batch run produces stage log entries in issue body

## Verification

1. Run existing tests: `bun test`
2. Create a test issue, run `barf plan` + `barf build` on it, verify `## Stage Log` section in the issue file with correct entries
3. Verify no "Run Stats" blocks are produced (replaced by stage log)
4. Verify dashboard triage still works — transition from dashboard writes stage log entry with trigger "manual/dashboard"
