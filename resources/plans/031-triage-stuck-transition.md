# 031 — Transition to STUCK when triage flags needs_interview

## Context

When triage determines an issue `needs_interview=true`, the issue stays in `NEW` state but is gated from planning. This is invisible in the kanban/status view — you have to know about the `needs_interview` flag. Changing the state to `STUCK` makes the blocker visible and uses the existing semantic ("needs human intervention").

## Changes

### 1. Add `NEW → STUCK` to state machine

**File**: `src/core/issue/index.ts:21`

```diff
- NEW: ['PLANNED'],
+ NEW: ['PLANNED', 'STUCK'],
```

### 2. Transition to STUCK in triage when needs_interview=true

**File**: `src/core/triage/triage.ts` (~line 149)

After writing `needs_interview: true`, also transition the issue to `STUCK`:

```typescript
const writeResult = await provider.writeIssue(issueId, {
  needs_interview: true,
  state: 'STUCK',
  body: issue.body + questionsSection,
})
```

### 3. Update auto.ts gate check to look for STUCK + needs_interview

**File**: `src/cli/commands/auto.ts:95-103`

The gate check currently filters `state === 'NEW' && needs_interview === true`. Update to also catch `STUCK` issues with `needs_interview`:

```diff
- const needsInterview = refreshed.filter(
-   (i) => i.state === 'NEW' && i.needs_interview === true,
- )
+ const needsInterview = refreshed.filter(
+   (i) => i.needs_interview === true,
+ )
```

(Simpler — just check the flag regardless of state, since STUCK issues already won't be picked up for planning.)

### 4. Update tests

**Files**:
- `tests/unit/issue.test.ts` — Add `NEW → STUCK` as valid transition
- `tests/unit/triage.test.ts` — Verify triage sets `state: 'STUCK'` when `needs_interview=true`

### 5. Update /barf-interview skill to transition STUCK → NEW after interview

**File**: `.claude/commands/barf-interview.md`

After clearing `needs_interview`, set `state=NEW` so the issue re-enters the pipeline.

## Verification

```bash
bun test tests/unit/issue.test.ts
bun test tests/unit/triage.test.ts
```
