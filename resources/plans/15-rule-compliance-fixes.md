# Rule Compliance Fixes

## Context

A systematic audit of the codebase against `.claude/rules/` (hard-requirements.md, code-patterns.md,
typescript-advanced.md) found 7 confirmed violations. The previous production-code-audit session
fixed TSDoc gaps in `claude.ts` and `github.ts`, but missed issues in `context.ts`,
`execFileNoThrow.ts`, `build.ts`, and `auto.ts`. This plan corrects all confirmed violations;
agent-hallucinated findings are excluded.

---

## Violations to Fix

### 1. Stale `.js` Extension in Import — `build.ts:1`

**Rule:** Codebase convention (all other `@/` imports omit `.js`).

```ts
// current
import type { IssueProvider } from '@/core/issue-providers/base.js'
// fix
import type { IssueProvider } from '@/core/issue-providers/base'
```

---

### 2. `Set<string>` Loses `IssueState` Type Safety — `build.ts:48`, `auto.ts:9-11`

**Rule:** code-patterns.md — no `any`/widened types; typescript-advanced.md — literal types.

`build.ts:48`: `new Set<string>(['PLANNED', 'PLANNED', 'NEW'])` — widened to `string` while
`i.state` is `IssueState`. Fix: `Set<IssueState>`.

`auto.ts:9-11`: Same — `new Set(['NEW'])` and `new Set(['PLANNED', 'PLANNED'])` are
implicitly `Set<string>`. Fix: explicit `Set<IssueState>` type.

Both files need `import type { IssueState } from '@/types/index'` (or `'@/types'`).

`auto.ts` already imports from `'@/types'` (for `Config`), so extend the import.
`build.ts` already imports from `'@/types/index'`.

---

### 3. Missing `@param` / `@returns` in `parseClaudeStream` — `context.ts:20-26`

**Rule:** hard-requirements.md — all exported functions must have TSDoc with `@param` (when non-obvious)
and `@returns` for generators.

Current comment has no `@param` tags for `proc`, `threshold`, or `streamLogFile`. No `@returns`.
Fix: add three `@param` entries and an `@returns` describing the yielded `ClaudeEvent` types and
the thrown errors (`ContextOverflowError`, `RateLimitError`).

```ts
/**
 * Async generator that parses Claude's --output-format stream-json stdout.
 * Yields ClaudeEvent (usage | tool). Kills proc and throws on overflow or rate limit.
 *
 * Token tracking: only from main context (parent_tool_use_id === null).
 * Sub-agent tokens are ignored to prevent premature interruption during tool calls.
 *
 * @param proc - The Claude subprocess; must expose `stdout` and `kill`.
 * @param threshold - Token count at which to kill the process and throw {@link ContextOverflowError}.
 * @param streamLogFile - Optional path; each raw JSONL line is appended for debugging.
 * @returns Async generator yielding {@link ClaudeEvent} objects; throws {@link ContextOverflowError}
 *   on threshold breach or {@link RateLimitError} on API rate limiting.
 */
```

---

### 4. Missing `@param` / `@returns` in `injectPromptVars` — `context.ts:129-147`

**Rule:** hard-requirements.md — same as above.

Current comment has no `@param` tags. Fix: add `@param template` and `@param vars`, plus `@returns`.

```ts
/**
 * Injects barf template variables into a prompt string.
 * Simple string replacement — no eval, no shell, injection-safe.
 *
 * @param template - Raw prompt template containing `${BARF_*}` or `$BARF_*` placeholders.
 * @param vars - Substitution values for each supported placeholder.
 * @returns The template with all recognized placeholders replaced by their string values.
 */
```

---

### 5. Missing TSDoc on `ExecResult` — `execFileNoThrow.ts:3-7`

**Rule:** hard-requirements.md — every exported type alias needs a `/** */` doc comment.

```ts
// fix
/**
 * Output from a subprocess spawned by {@link execFileNoThrow}.
 * `status` is the exit code (0 = success). Never throws — errors appear in `stderr` and `status`.
 */
export interface ExecResult {
```

---

### 6. `as` Casts on Parsed JSON in `context.ts` — `context.ts:66,73,82-87,104-107`

**Rule:** code-patterns.md — "No `any` Type / Type assertion without validation".

Three patterns:
- `JSON.parse(trimmed) as Record<string, unknown>` — this is a standard safe idiom (narrowing from
  `any`), keep as-is.
- `obj['rate_limit_info'] as { status?: string; resetsAt?: number } | undefined` — asserts shape
  without validation.
- Two `obj['message'] as { usage?: ... }` and `obj['message'] as { content?: ... }` — same.

**Fix:** Extract two internal Zod schemas for Claude stream objects to validate the shapes:

```ts
// at top of context.ts (not exported — internal parsing only)
const RateLimitEventSchema = z.object({
  type: z.literal('rate_limit_event'),
  rate_limit_info: z.object({ status: z.string().optional(), resetsAt: z.number().optional() }).optional()
})

const UsageEventSchema = z.object({
  parent_tool_use_id: z.null(),
  message: z.object({
    usage: z.object({
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional()
    }).optional()
  }).optional()
})

const AssistantEventSchema = z.object({
  type: z.literal('assistant'),
  message: z.object({
    content: z.array(z.object({ type: z.string(), name: z.string().optional() })).optional()
  }).optional()
})
```

Replace the three `as` casts with `.safeParse(obj)` calls. The `JSON.parse as Record<string,unknown>`
line can be removed entirely; Zod parses from `unknown` directly.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/cli/commands/build.ts` | Fix `.js` import; `Set<string>` → `Set<IssueState>` |
| `src/cli/commands/auto.ts` | `Set<string>` → `Set<IssueState>`; import `IssueState` |
| `src/core/context.ts` | Add `@param`/`@returns` to both functions; replace 3 `as` casts with Zod schemas |
| `src/utils/execFileNoThrow.ts` | Add TSDoc to `ExecResult` |

---

## Verification

```bash
bun run check        # format:check + lint must pass
bun test             # 148 tests must still pass
bun run build        # binary compiles cleanly
```

TypeScript strict mode (`"strict": true` in tsconfig) will catch any type regressions from the
`Set<IssueState>` changes at compile time.

---

## Notes

- **`build.ts:27` ternary** — agent flagged but is a simple (non-nested) ternary; not a violation.
- **`local.ts` `as NodeJS.ErrnoException`** — agent hallucinated; code doesn't contain this.
- **`base.ts`, `factory.ts` `@param`** — already correctly documented; false positives.
- **`issue.ts` `@returns`** — already backtick-formatted correctly; false positive.
