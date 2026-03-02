# Fix: Stats not persisted when build completes in one iteration

## Context

When `barf build` runs and Claude completes the issue in a single iteration, all stats
fields (`total_input_tokens`, `total_output_tokens`, `total_iterations`, `run_count`)
remain 0. The issue correctly transitions to BUILT but the observability data is lost.

**Root cause**: `state.iteration` is incremented at the **bottom** of the while loop body.
When `handleBuildCompletion` returns `'break'`, the `break` fires before `state.iteration++`,
leaving `state.iteration === 0`. The `finally` block then guards on `stats.iterations > 0`,
which is false, so `persistSessionStats` is never called.

The same off-by-one affects overflow iterations (which use `continue` to skip the increment)
but that is a pre-existing imprecision.

## Fix

### 1. Add `iterationsRan` to `LoopState` — `src/core/batch/outcomes.ts`

Add a new field to the mutable loop state:
```ts
/** Number of Claude iterations that actually ran (incremented before each Claude call). */
iterationsRan: number
```

### 2. Initialize in loop — `src/core/batch/loop.ts`

In the `state` object literal: `iterationsRan: 0`

### 3. Increment early in the while loop body — `src/core/batch/loop.ts`

After the `BUILT` early-break check and before the `logger.info('starting iteration')` call:
```ts
state.iterationsRan++
```

### 4. Fix finally block — `src/core/batch/loop.ts`

Change stats creation + guard from:
```ts
const stats = createSessionStats(..., state.iteration, ...)
if (stats.iterations > 0) { await persistSessionStats(...) }
```
to:
```ts
const stats = createSessionStats(..., state.iterationsRan, ...)
if (state.iterationsRan > 0) { await persistSessionStats(...) }
```

### 5. Fix `handleSplitCompletion` — `src/core/batch/outcomes.ts`

The split handler already calls `persistSessionStats` directly before returning `'return'`.
Since the `finally` block still runs after `return`, it would **double-persist** if
`state.iterationsRan > 0`. Fix: after calling `persistSessionStats` inside
`handleSplitCompletion`, set `state.iterationsRan = 0` to neutralize the finally guard.

Also update `handleSplitCompletion` to use `state.iterationsRan` instead of `state.iteration + 1`.

## Files

- `src/core/batch/outcomes.ts` — add `iterationsRan` to `LoopState`, fix split handler
- `src/core/batch/loop.ts` — initialize, increment, and use `iterationsRan` in finally

## Tests

Add a test in `tests/unit/batch-runloop.test.ts`:
- Single-iteration build completes → assert `total_input_tokens > 0`, `run_count === 1`, `total_iterations === 1`

Run: `bun test tests/unit/batch-runloop.test.ts`
