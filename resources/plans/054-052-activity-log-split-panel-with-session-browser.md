# 052 — Activity Log Split Panel with Session Browser

## Context

With parallel issue processing now supported (051), multiple barf sessions can run simultaneously — from the dashboard, terminal, or both. The current ActivityLog panel is ephemeral: it shows only the current command's output and clears on each new run. There's no way to browse historical sessions, see what's running across the system, or stop external processes.

**Goal:** Refactor the ActivityLog into a split panel with a session list on the left and session detail on the right. Users can browse historical and running sessions, and stop any running barf process.

## Design

### Session Index: `.barf/sessions.jsonl`

A separate append-only file tracking session lifecycle. Each line is a JSON record:

```typescript
// Session start — written by runLoop at lock acquisition
{ event: "start", sessionId: string, pid: number, issueId: string, mode: LoopMode, model: string, timestamp: string }

// Session end — written by runLoop in finally block
{ event: "end", sessionId: string, pid: number, exitCode: number | null, timestamp: string,
  inputTokens: number, outputTokens: number, iterations: number, durationSeconds: number }

// Auto session — wraps multiple issue sessions
{ event: "auto_start", sessionId: string, pid: number, timestamp: string }
{ event: "auto_end", sessionId: string, pid: number, timestamp: string, issueCount: number }
```

`sessionId` = `${issueId}-${Date.now()}` for issue sessions, `auto-${Date.now()}` for auto runs.

**Why separate file:** Raw SDK JSONL in `.barf/streams/{issueId}.jsonl` stays clean. Session metadata (PID, mode, tokens, duration) lives in its own index. Dashboard reads the index for the session list, then tails the stream JSONL for detail.

### Session List (Left Panel)

Backend:
- **`GET /api/sessions`** — reads `.barf/sessions.jsonl`, returns `Session[]` (start + end merged by sessionId). For sessions without an `end` event, checks if PID is alive → `status: 'running' | 'completed' | 'crashed'`.
- **`POST /api/sessions/:pid/stop`** — sends `SIGTERM` to the PID. Validates PID is in the session index first (safety).

Frontend:
- New `SessionList` Preact component
- Groups: "Running" (sorted by start time desc) and "Recent" (last ~20 completed)
- Each row: mode icon, issue ID badge, duration/time-ago, status indicator (green dot = running)
- Click to select → loads detail in right panel
- Stop button on running sessions

### Session Detail (Right Panel)

The existing `ActivityLog` component, largely unchanged, but now:
- Reads from a specific session's JSONL range (byte offsets from session index) instead of live-only
- For running sessions: tails the JSONL in real-time (existing SSE logic)
- For completed sessions: loads historical entries via `/api/issues/:id/logs/history` with byte range

### Auto Sessions

An auto run creates one top-level `auto_start/auto_end` session. Each issue it processes creates a child session with a `parentSessionId` field. The session list shows the auto session as an expandable group with child issue sessions nested underneath.

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/types/schema/session-index-schema.ts` | Zod schemas for session index events |
| `src/core/batch/session-index.ts` | `writeSessionStart()`, `writeSessionEnd()` — append to `.barf/sessions.jsonl` |
| `tools/dashboard/services/session-service.ts` | Read + parse session index, PID liveness check |
| `tools/dashboard/routes/sessions.ts` | `GET /api/sessions`, `POST /api/sessions/:pid/stop` |
| `tools/dashboard/frontend/components/SessionList.tsx` | Left panel session browser component |

### Modified Files

| File | Change |
|------|--------|
| `src/core/batch/loop.ts` | Call `writeSessionStart` after lock, `writeSessionEnd` in finally |
| `src/cli/commands/auto.ts` | Write `auto_start`/`auto_end` events |
| `src/core/batch/index.ts` | Export session index functions |
| `tools/dashboard/frontend/components/ActivityLog.tsx` | Accept `sessionId` prop, load historical or tail live |
| `tools/dashboard/frontend/lib/state.ts` | Add `sessions`, `selectedSessionId` signals |
| `tools/dashboard/frontend/lib/actions.ts` | Add `fetchSessions()`, `selectSession()`, `stopSession()` actions |
| `tools/dashboard/frontend/main.tsx` | Wire split panel layout |
| `tools/dashboard/server.ts` | Register session routes |
| `tools/dashboard/routes/sse.ts` | Add session-scoped log tailing (byte range) |
| `tools/dashboard/services/log-reader.ts` | Add byte-range read support |

### Existing to Reuse

| Utility | File | Usage |
|---------|------|-------|
| `parseLogMessage()` | `services/activity-aggregator.ts` | Parse JSONL entries for session detail |
| `readNewLines()` | `services/log-reader.ts` | Tail JSONL for live sessions |
| `SSEClient` | `frontend/lib/sse-client.ts` | Stream live session activity |
| `ProcessedEntry` types | `frontend/lib/types.ts` | Activity entry rendering |
| Lock file PID check | `providers/local.ts:readLockIfAlive()` | Reuse pattern for PID liveness |

## Session ID & Byte Offset Tracking

Each session start event records the **current byte offset** of the issue's JSONL stream file:

```typescript
{ event: "start", sessionId, pid, issueId, mode, model, timestamp, streamOffset: number }
```

And on end:
```typescript
{ event: "end", sessionId, ..., streamEndOffset: number }
```

This allows the dashboard to read exactly the bytes for a specific session from the stream file, without re-parsing the entire JSONL.

## Verification

1. **Unit tests:** Session index write/read, PID liveness check, byte-range parsing
2. **Existing tests:** `bun test` — no regressions
3. **Manual — single session:** Run `barf build --issue 42`, check dashboard shows session in list, click to see activity
4. **Manual — parallel:** Run `barf build --batch 2`, verify two running sessions appear
5. **Manual — stop:** Click stop on a running session, verify process terminates and session shows as completed
6. **Manual — terminal process:** Run `barf build` from terminal, verify dashboard sees it via session index
7. **Manual — auto:** Run `barf auto`, verify auto session with nested child sessions
8. **Dashboard build:** `bun run dashboard:build` succeeds
