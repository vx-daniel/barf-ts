# 029 — Domain-Driven Modularization

## Context

The codebase has grown organically. Several files exceed 300 lines and mix 5+ concerns (I/O, display, parsing, state transitions, error handling). `types/index.ts` is a 264-line monolith defining 5 unrelated domains. `batch.ts` has a 250-line function with 5 nesting levels. `claude.ts` tangles stream consumption with TTY display and logging.

**Goal:** Break large files into focused, single-responsibility modules. Bottom-up: fix the type foundation first, then refactor consumers.

**Approach:** Domain-Driven Split — reorganize by domain boundaries with schemas, logic, and errors co-located. Breaking import changes are OK.

### Cross-Cutting Requirements (apply to ALL phases)

**1. Extensive TSDoc comments** — Every exported symbol gets a `/** */` block explaining WHY it exists, what it does, and how it fits into the system. Target audience: junior developers who are new to the codebase. Follow the project's TSDoc conventions in `.claude/rules/hard-requirements.md`:
- `@param name - desc` (no `{Type}`)
- `@returns` with both `ok(X)` / `err(Y)` arms for Result types
- `{@link SymbolName}` for cross-references
- `@example` on abstract methods
- File-level module doc comments explaining the purpose of each new file

**2. Keep all schemas together in `src/types/schema/`** — All Zod schemas live in `src/types/schema/`. Logic files in `src/core/` import schemas from there. No schema definitions in core files.

**3. Minimize interfaces and standalone types — prefer Zod schemas** — Convert existing `interface` and `type` declarations to Zod schemas with `z.infer<>` wherever possible. Interfaces to convert:
- `DisplayContext` (types/index.ts:223) → `DisplayContextSchema` in `src/types/schema/display-schema.ts`
- `FixStep` (core/pre-complete.ts:9) → `FixStepSchema` in `src/types/schema/pre-complete-schema.ts`
- `VerifyCheck`, `VerifyFailure` (core/verification.ts:14,21) → schemas in `src/types/schema/verification-schema.ts`

Exceptions (keep as `type`): function signatures like `ExecFn`, `RunLoopDeps`, `*Factory`, `*Deps` — these are dependency injection types that can't be expressed as Zod schemas.

---

## Phase 1: Split `types/index.ts` into domain schemas

`types/index.ts` currently defines Issue, Config, Lock, Events, Display, and Error types in one file. Some schemas already live in `types/schema/` (batch, mode, claude, session-stats, etc.). Continue that pattern.

### New files:
- **`src/types/schema/issue-schema.ts`** — Move `IssueStateSchema`, `IssueState`, `IssueSchema`, `Issue` from `types/index.ts`
- **`src/types/schema/config-schema.ts`** — Move `ConfigSchema`, `Config`
- **`src/types/schema/lock-schema.ts`** — Move `LockModeSchema`, `LockMode`, `LockInfoSchema`, `LockInfo`
- **`src/types/schema/events-schema.ts`** — Move `ClaudeEventSchema`, `ClaudeEvent`
- **`src/types/schema/display-schema.ts`** — Convert `DisplayContext` interface → `DisplayContextSchema` Zod object + `z.infer<>` type
- **`src/types/schema/verification-schema.ts`** — Convert `VerifyCheck`, `VerifyFailure`, `VerifyResult` interfaces → Zod schemas
- **`src/types/schema/pre-complete-schema.ts`** — Convert `FixStep`, `PreCompleteResult` → Zod schemas
- **`src/errors/index.ts`** — Move `InvalidTransitionError`, `ProviderError`

### Modify:
- **`src/types/index.ts`** — Becomes a barrel re-export file only (re-exports everything from schema files + errors)

### Update imports in consumers:
All files importing from `@/types` or `@/types/index` continue to work via barrel. No consumer changes needed in Phase 1 (barrel preserves paths).

---

## Phase 2: Split `batch.ts` into focused modules

Current: 437 lines, 9 responsibilities. `runLoopImpl` is 250+ lines.

### New directory: `src/core/batch/`
- **`src/core/batch/index.ts`** — Public API: re-exports `runLoop`, `RunLoopDeps`, types
- **`src/core/batch/loop.ts`** — `runLoopImpl` (the main while loop) + `runLoop` wrapper
- **`src/core/batch/outcomes.ts`** — `handleOverflow()`, split-pending handler, rate-limit handler, plan-mode completion, build-mode completion (extracted from runLoopImpl's if/else branches)
- **`src/core/batch/stats.ts`** — `persistSessionStats()`, session stats creation helper
- **`src/core/batch/helpers.ts`** — `shouldContinue()`, `resolveIssueFile()`, `planSplitChildren()`

### Strategy for splitting `runLoopImpl`:
Extract each outcome branch into a named function in `outcomes.ts`:
- `handleSplitCompletion(...)` — lines 277-300 (split iteration completed)
- `handleOverflowOutcome(...)` — lines 303-323
- `handlePlanCompletion(...)` — lines 344-353
- `handleBuildCompletion(...)` — lines 356-388

The main loop in `loop.ts` becomes a clean dispatcher:
```
while (shouldContinue(...)) {
  const result = await runIteration(...)
  if (splitPending) return handleSplitCompletion(...)
  if (outcome === 'overflow') { handleOverflowOutcome(...); continue }
  if (outcome === 'rate_limited') throw ...
  if (outcome === 'error') break
  if (mode === 'plan') return handlePlanCompletion(...)
  if (mode === 'build') { handleBuildCompletion(...) }
}
```

### Delete:
- `src/core/batch.ts` (replaced by `src/core/batch/` directory)

---

## Phase 3: Split `claude.ts` into focused modules

Current: 308 lines. `consumeSDKQuery` is 150 lines mixing stream iteration, TTY display, token tracking, and error conversion.

### New directory: `src/core/claude/`
- **`src/core/claude/index.ts`** — Public API: re-exports `runClaudeIteration`, `consumeSDKQuery`, context limit functions
- **`src/core/claude/context.ts`** — `MODEL_CONTEXT_LIMITS`, `getContextLimit()`, `setContextLimit()`, `getThreshold()`
- **`src/core/claude/stream.ts`** — `consumeSDKQuery()` (core stream iteration logic)
- **`src/core/claude/display.ts`** — TTY progress formatting functions:
  - `writeHeader(displayContext, stderrWrite)` — the sticky header line
  - `writeProgress(tokens, contextLimit, lastTool, stderrWrite)` — the context progress line
  - `clearProgress(displayContext, stderrWrite)` — the ANSI clear sequences
- **`src/core/claude/iteration.ts`** — `runClaudeIteration()` (SDK query setup, timeout, signal)

### Strategy:
Extract display logic as pure functions that `stream.ts` calls. This makes `consumeSDKQuery` focused on message iteration + token tracking + error detection, while display is independently testable.

### Delete:
- `src/core/claude.ts` (replaced by `src/core/claude/` directory)

---

## Phase 4: Remaining moderate-complexity files

### `verification.ts` → `src/core/verification/`
- **`checks.ts`** — `runVerification()` (pure: run commands, collect results)
- **`orchestration.ts`** — `verifyIssue()` split into `handlePassed()`, `handleFailed()`, `handleExhausted()`
- **`format.ts`** — `buildFixBody()` markdown formatting

### `triage.ts` → `src/core/triage/`
- **`triage.ts`** — `triageIssueImpl()` orchestration (slimmed)
- **`parse.ts`** — JSON response parsing + markdown fence stripping
- **`format.ts`** — `formatQuestionsSection()`

### `github.ts` — Extract helpers (lower priority)
- **`github-labels.ts`** — `STATE_TO_LABEL`, `LABEL_TO_STATE`, bidirectional conversion
- Keep `github.ts` as the provider class, now slimmer

---

## Phase 5: Update all imports

After each phase, update imports across the codebase. Since `types/index.ts` remains a barrel, most consumer imports won't change for Phase 1. For Phases 2-4, update imports from:
- `@/core/batch` → `@/core/batch` (index.ts barrel)
- `@/core/claude` → `@/core/claude` (index.ts barrel)

Run `bun run check` after each phase to catch any broken imports.

---

## Execution Order

1. Phase 1 (types) — Foundation, no consumer changes needed
2. Phase 2 (batch) — Highest complexity reduction
3. Phase 3 (claude) — Second highest
4. Phase 4 (verification, triage, github) — Moderate wins
5. Phase 5 runs continuously after each phase

Each phase is independently shippable and testable.

---

## Verification

After each phase:
1. `bun run check` — TypeScript compilation passes
2. `bun run test` — All 413 tests pass
3. `bun run lint` — Biome lint passes
4. Manual: `bun run src/index.ts status --cwd tests/sample-project` — CLI works

After all phases:
- No file in `src/core/` exceeds ~150 lines
- No function exceeds ~50 lines
- Each file has a single clear responsibility
- Every exported symbol has a TSDoc `/** */` comment
- No `interface` or standalone `type` where a Zod schema is feasible (only DI function types remain as `type`)
- All Zod schemas live in `src/types/schema/`, none in `src/core/`
- `bun run docs` (TypeDoc) passes with no broken `{@link}` references
