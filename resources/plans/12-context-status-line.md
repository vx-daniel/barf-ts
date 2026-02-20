# Plan: 12-context-status-line

## Context

Token usage is tracked in `parseClaudeStream` and surfaced via `usage` events, but is
only logged at `debug` level — invisible during normal runs. The previous bash barf
showed context size in-place on the terminal.

A naive `logger.info` promotion won't work: pino writes complete lines (`{...}\n`)
that move the cursor, so a subsequent `\r` status overwrite would fight against
pino's own output. The clean fix is **mode split by TTY**:

- **TTY (interactive)** — suppress pino stderr output; own stderr entirely for a
  live status line updated with `\r\x1b[K` on each token event.
- **Non-TTY (CI / pipes / LOG_PRETTY=1)** — no status line; pino writes JSON to
  stderr as normal (so structured output can be captured or piped).

`LOG_PRETTY=1` takes its own early-return path in `buildLogger`, so the multistream
change never applies to it — no special case needed there.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/logger.ts` | Suppress stderr stream when `process.stderr.isTTY` |
| `src/core/claude.ts` | Write/clear status line on usage + tool events |

---

## Implementation

### 1. `src/utils/logger.ts`

In `buildLogger`, replace the static multistream with a TTY-conditional one:

```typescript
// BEFORE
const streams = pino.multistream([
  { stream: pino.destination(2) },
  { stream: pino.destination(resolveLogFile()) },
])

// AFTER
const destinations: Parameters<typeof pino.multistream>[0] = [
  { stream: pino.destination(resolveLogFile()) },
]
if (!process.stderr.isTTY) {
  destinations.unshift({ stream: pino.destination(2) })
}
const streams = pino.multistream(destinations)
```

### 2. `src/core/claude.ts`

In `runClaudeIteration`, after computing `threshold`:

```typescript
const isTTY = process.stderr.isTTY ?? false
let lastTool = ''
```

Replace the event handling block:

```typescript
// BEFORE
if (event.type === 'usage') {
  lastTokens = event.tokens
  logger.debug({ tokens: event.tokens }, 'context update')
} else if (event.type === 'tool') {
  logger.debug({ tool: event.name }, 'tool call')
}

// AFTER
if (event.type === 'usage') {
  lastTokens = event.tokens
  logger.debug({ tokens: event.tokens, threshold }, 'context update')
  if (isTTY) {
    const pct = Math.round((event.tokens / threshold) * 100)
    const toolPart = lastTool ? `  |  ${lastTool}` : ''
    process.stderr.write(
      `\r\x1b[K  context: ${event.tokens.toLocaleString()} / ${threshold.toLocaleString()} (${pct}%)${toolPart}`
    )
  }
} else if (event.type === 'tool') {
  lastTool = event.name
  logger.debug({ tool: event.name }, 'tool call')
}
```

Clear the status line after the event loop exits (before `await proc.exited`):

```typescript
if (isTTY) process.stderr.write('\r\x1b[K')
```

---

## Behaviour

**Interactive terminal (default)**:
```
  context: 34,217 / 150,000 (23%)  |  Bash
```
Updates in-place on every token event. Cleared when iteration finishes.
All structured logs go to `barf.log` only.

**CI / pipe (`barf build 2>errors.log`)**:
```json
{"level":20,"name":"claude","tokens":34217,"threshold":150000,"msg":"context update"}
```
No status line. JSON to stderr as before.

**LOG_PRETTY=1** (unaffected — separate code path in `buildLogger`):
Pretty-prints to stderr. No status line.

---

## Verification

1. `bun test` — all tests green (no API change)
2. `bun run dev auto --cwd tests/sample-project` — status line appears and updates in-place
3. `bun run dev auto --cwd tests/sample-project 2>/dev/null` — no output (status suppressed)
4. `bun run dev auto --cwd tests/sample-project 2>&1 | cat` — JSON logs appear (non-TTY pipe)
5. `LOG_PRETTY=1 bun run dev auto --cwd tests/sample-project` — pretty logs, no status line
