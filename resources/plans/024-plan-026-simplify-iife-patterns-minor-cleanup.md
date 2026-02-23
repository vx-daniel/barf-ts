# Plan 026: Simplify IIFE Patterns + Minor Cleanup

## Context

The codebase has a recurring structural pattern that adds unnecessary indentation and obscures intent:

```typescript
export function foo(): ResultAsync<T, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<T> => {
      // 50–180 lines of logic here
    })(),
    toError
  )
}
```

The anonymous async IIFE exists purely to produce a Promise for `ResultAsync.fromPromise`. Naming it and pulling it out makes the public API trivial to read and the logic function independently testable. This pattern appears in 7 places across `batch.ts`, `triage.ts`, and all three providers.

Two additional minor issues:
- `base.ts::chatJSON` wraps `Promise.reject(new Error(...))` in `ResultAsync.fromPromise` twice — neverthrow's own `errAsync()` is the direct equivalent.
- `config.ts::parseBarfrc` defines `KEY_MAP` inside the `for` loop body, recreating it on every line iteration.

All changes are pure structure: **zero logic changes**.

## Changes

### 1. `src/core/batch.ts` — extract `runLoopImpl`

Extract the 180-line IIFE body to a named `async function runLoopImpl(...)`.
`runLoop` becomes a 3-line wrapper:

```typescript
async function runLoopImpl(issueId, mode, config, provider): Promise<void> {
  // ... existing body unchanged
}

export function runLoop(issueId, mode, config, provider): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(runLoopImpl(issueId, mode, config, provider), toError)
}
```

### 2. `src/core/triage.ts` — extract `triageIssueImpl`

Same extraction — 90-line IIFE body → named `triageIssueImpl`:

```typescript
async function triageIssueImpl(issueId, config, provider, execFn, displayContext): Promise<void> {
  // ... existing body unchanged
}

export function triageIssue(...): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(triageIssueImpl(issueId, config, provider, execFn, displayContext), toError)
}
```

### 3. `src/providers/openai.ts` — extract `pingImpl` / `chatImpl`

```typescript
private async pingImpl(): Promise<PingResult> {
  const start = Date.now()
  const client = new OpenAI({ apiKey: this.config.openaiApiKey })
  await client.chat.completions.create({ model, messages: [...], max_tokens: 1 })
  return { latencyMs: Date.now() - start, model: this.config.auditModel }
}

ping(): ResultAsync<PingResult, Error> {
  return ResultAsync.fromPromise(this.pingImpl(), toError)
}

private async chatImpl(prompt: string, opts?: ChatOptions): Promise<ChatResult> { ... }
chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
  return ResultAsync.fromPromise(this.chatImpl(prompt, opts), toError)
}
```

### 4. `src/providers/gemini.ts` — extract `pingImpl` / `chatImpl`

Same extraction as openai.ts.

### 5. `src/providers/claude.ts` — extract `pingImpl` / `chatImpl`

Same extraction as openai.ts.

### 6. `src/providers/base.ts` — use `errAsync` in `chatJSON`

Replace two instances of:
```typescript
return ResultAsync.fromPromise(
  Promise.reject(new Error(`...`)),
  toError
)
```
with:
```typescript
return errAsync(new Error(`...`))
```

Import `errAsync` from `neverthrow` (already available — used in tests).

### 7. `src/core/config.ts` — hoist `KEY_MAP` out of loop

Move the `KEY_MAP` object from inside the `for` loop to module scope (before `parseBarfrc`). No logic change — it was identical on every iteration.

```typescript
const KEY_MAP: Record<string, keyof Config> = {
  ISSUES_DIR: 'issuesDir',
  // ... all entries
}

export function parseBarfrc(content: string): Result<Config, z.ZodError> {
  const raw: Record<string, string> = {}
  for (const line of content.split('\n')) {
    // KEY_MAP now referenced, not redefined
    ...
  }
}
```

## Files to Modify

| File | Change |
|---|---|
| `src/core/batch.ts` | Extract `runLoopImpl` |
| `src/core/triage.ts` | Extract `triageIssueImpl` |
| `src/providers/openai.ts` | Extract `pingImpl`, `chatImpl` |
| `src/providers/gemini.ts` | Extract `pingImpl`, `chatImpl` |
| `src/providers/claude.ts` | Extract `pingImpl`, `chatImpl` |
| `src/providers/base.ts` | `errAsync` in `chatJSON` |
| `src/core/config.ts` | Hoist `KEY_MAP` to module scope |

## Not Included

- `consumeSDKQuery` in `claude.ts` — complex streaming logic with error handling that warrants a separate, careful plan
- `auto.ts` — already well-structured and readable
- `parseIssue` in `issue/index.ts` — functional; Zod-native rewrite is a larger refactor

## Verification

```bash
bun test                # 349 tests green
bun run check           # format + lint clean
```
