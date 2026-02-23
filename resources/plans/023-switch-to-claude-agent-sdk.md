# Switch barf-ts to @anthropic-ai/claude-agent-sdk

## Context

The agent runner currently spawns `claude -p --dangerously-skip-permissions --output-format
stream-json` as a subprocess, passes prompts via stdin, and parses JSONL from stdout. This is
causing stream format instability (dropped logs, lost responses), unexpected process exits, and
incomplete token tracking (cache tokens only). The `@anthropic-ai/claude-agent-sdk` package
provides the same agent runtime programmatically — no subprocess, no JSONL parsing, no stream
management.

---

## Approach: Direct SDK replacement

Replace subprocess internals while keeping the `runClaudeIteration(prompt, model, config, issueId?)`
public API unchanged. `batch.ts` changes zero lines.

SDK options:
- `permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true` (replaces `--dangerously-skip-permissions`)
- `settingSources: []` (no CLAUDE.md / project settings — all context from prompt, same as today)
- `abortController` (wires timeout → abort, same as current)
- `env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '100' }` (preserve disable-autocompact behavior)
- `cwd: process.cwd()` (project dir, already correct from CLI --cwd handling)

Token tracking improvement: current uses `cache_creation_input_tokens + cache_read_input_tokens` only.
New uses `input_tokens + cache_creation + cache_read` from `SDKAssistantMessage.message.usage` —
more accurate context window fill level.

Context overflow: `await q.interrupt()` (replaces `proc.kill('SIGTERM')`).

---

## Files Changed

### `package.json`
- Added `"@anthropic-ai/claude-agent-sdk": "latest"` to `dependencies`

### `src/core/claude.ts`
- **Removed:** `ClaudeProc` interface, `ConsumeStreamOptions` interface, `consumeClaudeStream()`
  (all subprocess-specific — no longer needed)
- **Removed:** `spawn` import from `bun`
- **Added:** `consumeSDKQuery()` (exported for testing; same role as old `consumeClaudeStream`)
  - Iterates `SDKMessage` from `q`
  - On `type === 'assistant'` with `parent_tool_use_id === null`: extracts token count from
    `msg.message.usage` (`input_tokens + cache_creation + cache_read`); throws `ContextOverflowError`
    after `q.interrupt()` if threshold exceeded; updates TTY progress line
  - On `type === 'assistant'`: scans `content` blocks for `type === 'tool_use'` → logs tool name;
    checks `msg.error === 'rate_limit'` → throws `RateLimitError`
  - On `type === 'result'` with `subtype === 'success'`: returns `{ outcome: 'success', tokens }`
  - On `type === 'result'` with error subtype: inspects `errors` array for rate-limit keywords →
    throws `RateLimitError` if matched, else returns `{ outcome: 'error', tokens }`
  - On `signal.aborted` after loop: returns `{ outcome: 'error', tokens }`
  - Catches `ContextOverflowError` → `{ outcome: 'overflow', tokens }`
- **Rewritten:** `runClaudeIteration()` — replaced `spawn(...)` with `query()` from SDK
- **Kept:** `getThreshold()`, `MODEL_CONTEXT_LIMITS`, exports of `IterationOutcome`/`IterationResult`
- **Kept:** `streamLogFile` support — logs SDK messages as JSON lines (same JSONL path, different shape)

### `src/core/context.ts`
- **Removed:** `parseClaudeStream()`, `RateLimitInfoSchema`, `UsageMessageSchema`,
  `AssistantContentSchema`, and their imports (`z`, `createWriteStream`, `ClaudeEvent`)
- **Kept:** `ContextOverflowError`, `RateLimitError` (still thrown from `consumeSDKQuery`)
- **Kept:** `injectTemplateVars()` (used in `batch.ts`, untouched)

### `src/types/index.ts`
- Updated `ClaudeEvent` comment from "Emitted by `parseClaudeStream`" to "Emitted during SDK iteration"

### `tests/unit/claude-iteration.test.ts`
- Rewrote to test `consumeSDKQuery` directly with injected mock `Query` objects
- Covers: success, overflow, rate_limited (via assistant error + result errors), error/timeout, TTY progress
- Removed `ClaudeProc`/`ConsumeStreamOptions` constructs

### `tests/unit/context.test.ts`
- Removed `parseClaudeStream` describe block entirely
- Kept `injectTemplateVars` tests unchanged

---

## Rate Limit Detection

Rate limits from the SDK can surface as:
1. `SDKAssistantMessage.error === 'rate_limit'` (during streaming)
2. `SDKResultError.errors` array containing rate-limit keywords

Both are handled: check `msg.error === 'rate_limit'` on assistant messages, and
`errors.some(e => /rate.?limit/i.test(e))` on error result messages.
