# Migrate Standalone Types to Zod Schemas

## Context

10 standalone `type`/`interface` declarations across 7 files violate the schema-first hard requirement. They need Zod schemas with `z.infer` types. Three overlapping mode unions (`LoopMode`, `PromptMode`, `AutoSelectMode`) will be unified under a single `BarfModeSchema` with `.extract()` narrowing.

## Decisions

- **Schema location**: New files in `src/types/schema/` alongside existing `audit-schema.ts`
- **Mode unions**: Unified into `BarfModeSchema = z.enum(['plan','build','split','interview'])`
- **LockMode**: Keep as type alias from same `LoopModeSchema` for semantic clarity
- **QAPair/QuestionsFile**: Stay local in `interview.ts` (not exported)
- **SpawnFn**: Stays in `github.ts` (function signature, not data shape)
- **Barrel**: Create `src/types/schema/index.ts`

## New Files

### `src/types/schema/mode-schema.ts`
- `BarfModeSchema = z.enum(['plan','build','split','interview'])` — superset
- `LoopModeSchema = BarfModeSchema.extract(['plan','build','split'])` — batch + locking
- `PromptModeSchema = BarfModeSchema` — prompt resolution (all 4)
- `AutoSelectModeSchema = BarfModeSchema.extract(['plan','build','interview'])` — auto-select
- Types: `BarfMode`, `LoopMode`, `PromptMode`, `AutoSelectMode`

### `src/types/schema/claude-schema.ts`
- `IterationOutcomeSchema = z.enum(['success','overflow','error','rate_limited'])`
- `IterationResultSchema = z.object({ outcome, tokens, rateLimitResetsAt? })`
- Types: `IterationOutcome`, `IterationResult`

### `src/types/schema/batch-schema.ts`
- `OverflowDecisionSchema = z.object({ action: z.enum(['split','escalate']), nextModel: z.string().min(1) })`
- Type: `OverflowDecision`

### `src/types/schema/openai-schema.ts`
- `OpenAIChatResultSchema = z.object({ content, promptTokens, completionTokens, totalTokens })`
- `OpenAIChatOptionsSchema = z.object({ temperature?, maxTokens?, responseFormat? })`
- Types: `OpenAIChatResult`, `OpenAIChatOptions`

### `src/types/schema/exec-schema.ts`
- `ExecResultSchema = z.object({ stdout, stderr, status })`
- Type: `ExecResult`

### `src/types/schema/index.ts`
- Barrel re-exporting all schema files

## Modified Files

### `src/types/index.ts`
- Remove `LockModeSchema` and `LockMode` definitions (lines 73-80)
- Import `LoopModeSchema` from `@/types/schema/mode-schema`
- Use `LoopModeSchema` in `LockInfoSchema.mode` field
- Re-export: `export { LoopModeSchema as LockModeSchema, type LoopMode as LockMode } from '@/types/schema/mode-schema'`

### `src/core/batch.ts`
- Remove `export type LoopMode` (line 20) and `export interface OverflowDecision` (lines 29-32)
- Import `type LoopMode` from `@/types/schema/mode-schema`
- Import `type OverflowDecision` from `@/types/schema/batch-schema`

### `src/core/claude.ts`
- Remove `export type IterationOutcome` (line 21) and `export interface IterationResult` (lines 30-34)
- Import both from `@/types/schema/claude-schema`

### `src/core/prompts.ts`
- Remove `export type PromptMode` (line 19)
- Import `type PromptMode` from `@/types/schema/mode-schema`
- Re-export for test compatibility: `export type { PromptMode } from '@/types/schema/mode-schema'`

### `src/core/issue/base.ts`
- Remove `export type AutoSelectMode` (line 10)
- Import `type AutoSelectMode` from `@/types/schema/mode-schema`
- Remove `LockMode` from `@/types` import; add `import type { LoopMode as LockMode } from '@/types/schema/mode-schema'` OR keep using `LockMode` via `@/types` re-export

### `src/core/openai.ts`
- Remove both `export interface` blocks (lines 13-18, 25-29)
- Import both types from `@/types/schema/openai-schema`

### `src/utils/execFileNoThrow.ts`
- Remove `export interface ExecResult` (lines 9-13)
- Add `export type { ExecResult } from '@/types/schema/exec-schema'` (re-export so `github.ts` import stays valid)

### `src/core/interview.ts`
- Replace `interface QAPair { question: string; answer: string }` with local Zod schema:
  ```
  const QAPairSchema = z.object({ question: z.string(), answer: z.string() })
  type QAPair = z.infer<typeof QAPairSchema>
  ```

### `src/cli/commands/audit.ts`
- Change inline `{ stdout: string; stderr: string; status: number } | null` to `ExecResult | null`
- Add import of `type ExecResult` from `@/types/schema/exec-schema`

## New Test Files

All follow `tests/unit/audit-schema.test.ts` pattern.

### `tests/unit/mode-schema.test.ts`
- `BarfModeSchema`: accepts 4 modes, rejects invalid
- `LoopModeSchema`: accepts plan/build/split, rejects interview
- `AutoSelectModeSchema`: accepts plan/build/interview, rejects split
- `PromptModeSchema`: accepts all 4

### `tests/unit/claude-schema.test.ts`
- `IterationOutcomeSchema`: enum values
- `IterationResultSchema`: valid data, missing outcome, optional rateLimitResetsAt

### `tests/unit/batch-schema.test.ts`
- `OverflowDecisionSchema`: split/escalate valid, invalid action rejects

### `tests/unit/openai-schema.test.ts`
- `OpenAIChatResultSchema`: valid/invalid
- `OpenAIChatOptionsSchema`: all optional, partial, none

### `tests/unit/exec-schema.test.ts`
- `ExecResultSchema`: valid/invalid

## Implementation Order

1. Create all `src/types/schema/*.ts` files (additive, nothing breaks)
2. Create `src/types/schema/index.ts` barrel (additive)
3. Update `src/types/index.ts` — swap LockModeSchema for LoopModeSchema import + re-export aliases
4. Update all consumer files — remove old defs, add schema imports (atomic with step 3)
5. Update test imports (`prompts.test.ts`)
6. Create 5 new test files
7. Convert `QAPair` in `interview.ts` to local Zod schema
8. Fix inline type in `audit.ts`

## Verification

```bash
bun test                # all 285 tests pass
bun run check           # format + lint clean
bun run build           # binary compiles
```

Grep checks:
- `grep -r 'export interface' src/` — should only show error classes and `IssueProvider` abstract class methods
- `grep -r 'export type.*=' src/` — should only show `z.infer` derivations and function type aliases (`SpawnFn`)
