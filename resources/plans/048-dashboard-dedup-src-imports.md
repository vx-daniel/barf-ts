# 048 — Deduplicate Dashboard ↔ src/ Shared Types & Constants

## Problem

The dashboard frontend manually redeclares types, constants, and business rules that already exist in `src/`. This creates drift risk — adding a new `IssueState` or config key requires updating 3-4 files manually.

| Duplicate | Frontend location | Canonical source |
|---|---|---|
| `Issue` interface | `frontend/lib/types.ts` | `src/types/schema/issue-schema.ts` (Zod-inferred) |
| `VALID_TRANSITIONS` | `frontend/lib/transitions.ts` | `src/core/issue/index.ts` |
| `IssueState` values | `frontend/lib/constants.ts` (STATE_ORDER, STATE_COLORS, STATE_LABELS, CMD_ACTIONS) | `src/types/schema/issue-schema.ts` (IssueStateSchema) |
| `ActivityKind/Source/Entry` | `frontend/lib/types.ts` | `services/activity-aggregator.ts` (also a copy) |
| Config enum options | `frontend/panels/config.ts` FIELDS array | `src/types/schema/config-schema.ts` Zod enums |
| `REVERSE_KEY_MAP` | `routes/api.ts` | Implicit from ConfigSchema keys |

## Approach: Direct Import via `@/` Path Alias

**No shared package needed.** The Bun bundler (`tools/dashboard/build.ts`) already resolves TypeScript path aliases from `tsconfig.json`. The schema files in `src/types/schema/` only depend on `zod` (already a frontend dep) — no server-only deps like `neverthrow`, `pino`, or `@anthropic-ai/claude-agent-sdk`.

Key insight: import from the **schema files directly** (`@/types/schema/issue-schema`), not from `@/core/issue/index.ts` which imports `neverthrow`.

## Steps

### Step 1: Import `Issue` type from `src/`

**File:** `tools/dashboard/frontend/lib/types.ts`

- Delete the manual `Issue` interface (lines 41-60)
- Add: `export type { Issue } from '@/types/schema/issue-schema'`
- This gives the frontend the exact Zod-inferred type including `IssueState` (not widened `string`)

**Verify:** `bun run tools/dashboard/build.ts` — confirm bundler resolves `@/` import for browser target.

### Step 2: Import `VALID_TRANSITIONS` from `src/`

**File:** `tools/dashboard/frontend/lib/transitions.ts`

- Delete the entire file (it's a hand-copy with a comment admitting as much)
- Update the one importer (`panels/editor.ts`) to import from `@/core/issue`

**Risk:** `@/core/issue/index.ts` imports from `neverthrow`. Two options:
- **Option A (preferred):** Extract `VALID_TRANSITIONS` into `src/types/schema/issue-schema.ts` (pure Zod file, no neverthrow). Re-export from `@/core/issue` for backwards compat.
- **Option B:** Import from `@/core/issue` and rely on tree-shaking to eliminate `neverthrow`. Needs testing.

### Step 3: Derive `STATE_ORDER` from `IssueStateSchema`

**File:** `tools/dashboard/frontend/lib/constants.ts`

- Replace hardcoded `STATE_ORDER` array with:
  ```ts
  import { IssueStateSchema } from '@/types/schema/issue-schema'
  export const STATE_ORDER = IssueStateSchema.options
  ```
- Keep `STATE_COLORS`, `STATE_LABELS`, `CMD_ACTIONS` as-is (they map state→UI metadata that doesn't exist in `src/`), but type their keys as `IssueState` instead of `string` for compile-time safety when a new state is added.

### Step 4: Consolidate `ActivityKind/Source/Entry`

**New file:** `src/types/schema/activity-schema.ts`

Move the three types (`ActivityKind`, `ActivitySource`, `ActivityEntry`) here as Zod schemas (or plain types — they have no validation logic).

- `tools/dashboard/frontend/lib/types.ts` → re-export from `@/types/schema/activity-schema`
- `tools/dashboard/services/activity-aggregator.ts` → import from `@/types/schema/activity-schema`

### Step 5: Extract config enum values for frontend use

**File:** `tools/dashboard/frontend/panels/config.ts`

The `FIELDS` array hardcodes enum options like `['openai', 'gemini', 'claude', 'codex']` that duplicate `ConfigSchema` Zod enums.

- Import relevant enum schemas from `@/types/schema/config-schema`
- Extract `.options` from each `z.enum()` to populate the `options` arrays in `FIELDS`
- Example: `options: AuditProviderSchema.options` instead of hardcoded array

**Note:** `REVERSE_KEY_MAP` in `routes/api.ts` is harder to derive automatically (it maps camelCase→SCREAMING_SNAKE). Leave as-is for now — it's server-side only and less likely to drift.

### Step 6: Verify build + type-check

- `bun run tools/dashboard/build.ts` — confirm browser bundle builds
- `bunx tsc --noEmit` — confirm no type errors
- Manually check bundle size hasn't bloated (Zod should already be included; no new deps)

## Non-Goals

- **No shared package/workspace** — unnecessary complexity for one consumer
- **No changes to `REVERSE_KEY_MAP`** — server-side only, low drift risk
- **No changes to `CMD_ACTIONS` values** — these encode UI behavior, not domain rules; just type the keys
- **No runtime changes** — this is purely a refactor for type safety and DRY

## Expected Outcome

- Adding a new `IssueState` to `IssueStateSchema` will cause **compile errors** in dashboard constants that haven't been updated (instead of silent drift)
- `Issue` type in frontend gains real `IssueState` union instead of `string`
- 3 files deleted (`transitions.ts`, duplicate types), ~50 lines removed across remaining files
