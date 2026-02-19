# Plan: 11-stream-log-file

## Context

Claude's stdout produces a raw JSONL stream (`--output-format stream-json`) that is parsed on the fly in `parseClaudeStream()` but never persisted. This makes debugging, auditing, and post-hoc analysis of Claude's outputs impossible. The goal is to optionally log the full raw stream to per-issue files in a configurable directory, disabled by default.

---

## Config Key

```
STREAM_LOG_DIR=logs/streams
```

- Empty string (default) → logging disabled
- When set, each issue writes raw JSONL to `{streamLogDir}/{issueId}.jsonl` in append mode
- Multiple iterations of the same issue append to the same file
- Concurrent batch builds write to separate files (no interleaving)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `streamLogDir` to `ConfigSchema` |
| `src/core/config.ts` | Add to `RawConfigSchema` + `KEY_MAP` |
| `src/core/context.ts` | Add optional `streamLogFile` param, tee raw lines to file |
| `src/core/claude.ts` | Compute per-issue log path, mkdir, pass to `parseClaudeStream` |

---

## Implementation

### 1. `src/types/index.ts`

In `ConfigSchema` (around line 55), add:
```typescript
streamLogDir: z.string().default(''),
```

### 2. `src/core/config.ts`

In `RawConfigSchema` (lines 8–13), add:
```typescript
streamLogDir: z.coerce.string().default(''),
```

In `KEY_MAP` (lines 27–42), add:
```typescript
STREAM_LOG_DIR: 'streamLogDir',
```

### 3. `src/core/context.ts`

Add `fs` import:
```typescript
import { createWriteStream } from 'fs'
import type { WriteStream } from 'fs'
```

Update `parseClaudeStream` signature (add optional third param):
```typescript
export async function* parseClaudeStream(
  proc: ProcAdapter,
  threshold: number,
  streamLogFile?: string
): AsyncGenerator<ClaudeEvent>
```

Inside the generator, open log stream and tee each raw line:
```typescript
const logStream: WriteStream | null = streamLogFile
  ? createWriteStream(streamLogFile, { flags: 'a' })
  : null

try {
  // ... existing buffer/reader loop ...
  // At the point a complete line is extracted (before JSON.parse):
  logStream?.write(line + '\n')
  // ... existing JSON parsing and event yielding ...
} finally {
  logStream?.end()
}
```

The `try/finally` ensures the stream is closed even if the generator is abandoned early (SIGTERM, rate limit).

### 4. `src/core/claude.ts`

Add imports:
```typescript
import { join } from 'path'
import { mkdirSync } from 'fs'
```

In `runClaudeIteration`, before calling `parseClaudeStream`, compute the log file path:
```typescript
let streamLogFile: string | undefined
if (config.streamLogDir) {
  mkdirSync(config.streamLogDir, { recursive: true })
  streamLogFile = join(config.streamLogDir, `${issueId}.jsonl`)
}

for await (const event of parseClaudeStream(procAdapter, threshold, streamLogFile)) {
```

---

## Log Format

Each line in `{streamLogDir}/{issueId}.jsonl` is a raw JSON object exactly as emitted by Claude's `--output-format stream-json` — no transformation. Example entries:

```jsonl
{"type":"system","subtype":"init","session_id":"...","tools":[...]}
{"type":"assistant","message":{"role":"assistant","content":[...]}}
{"type":"result","subtype":"success","result":"...","usage":{...}}
```

---

## Verification

1. **Config round-trip**: Add `STREAM_LOG_DIR=.barf-logs` to `.barfrc`, run `bun run dev status` — no crash, config parsed correctly
2. **Stream logging**: Run `bun run dev plan` with a real issue, verify `.barf-logs/{issueId}.jsonl` appears and contains valid JSONL
3. **Append across iterations**: Run `bun run dev build` with multi-iteration issue — verify all iterations append to same file
4. **Disabled by default**: Without `STREAM_LOG_DIR` set, no log files created
5. **Tests pass**: `bun test` — all tests green (no signature break since param is optional)
6. **Build clean**: `bun run build` — no TypeScript errors
