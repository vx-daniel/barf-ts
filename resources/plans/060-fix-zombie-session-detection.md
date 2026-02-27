# 060 — Fix zombie process detection and Stop All in dashboard

## Context

The dashboard's "Stop All" button fails to kill orphaned `barf auto` sessions because the underlying processes are **zombies** (`Z+` / `<defunct>`). `isPidAlive()` in `session-service.ts` uses `process.kill(pid, 0)` which succeeds on zombies, so they appear as "running" forever. `SIGTERM` also "succeeds" silently but does nothing since the process is already dead — it just hasn't been reaped.

**Root cause**: `Bun.spawn()` in `sse.ts` creates child processes. When the SSE connection drops (browser refresh, tab close), the `activeProc` reference is lost but the child process may become a zombie if its parent doesn't reap it. The session index then shows it as "running" indefinitely.

## Plan

### 1. Detect zombies in `isPidAlive()` — `tools/dashboard/services/session-service.ts`

Read `/proc/{pid}/status` to check if the process is a zombie before declaring it alive:

```typescript
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    // Check for zombie — signal 0 succeeds on zombies but they're dead
    const status = readFileSync(`/proc/${pid}/status`, 'utf8')
    if (/^State:\s+Z/m.test(status)) return false
    return true
  } catch {
    return false
  }
}
```

This is Linux-specific but the project already targets Linux (Bun on Linux).

### 2. Force-stop zombie sessions — `tools/dashboard/services/session-service.ts`

Enhance `stopSession()` to handle zombies: if `SIGTERM` doesn't actually kill it (zombie), write an `end` event so the session is marked completed/crashed:

```typescript
export function stopSession(barfDir: string, pid: number): boolean {
  const events = readEvents(barfDir)
  const knownPids = new Set(events.map((e) => e.pid))
  if (!knownPids.has(pid)) return false

  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // Already dead — fall through to mark ended
  }

  // If it's a zombie or already dead, write end events for all open sessions with this PID
  if (!isPidAlive(pid)) {
    markSessionsEnded(barfDir, pid, events)
  }

  return true
}
```

Add helper `markSessionsEnded()` that appends `end`/`auto_end` events for sessions with the given PID that lack end events.

### 3. Reap zombie on spawn exit — `tools/dashboard/routes/sse.ts`

Ensure `Bun.spawn()` processes are properly awaited/reaped when the SSE stream ends, even on disconnect. The `spawnSSEStream` function should call `.exited` (Bun's promise for process exit) to ensure reaping.

## Files to modify

- `tools/dashboard/services/session-service.ts` — `isPidAlive()`, `stopSession()`, new `markSessionsEnded()`
- `tools/dashboard/routes/sse.ts` — ensure process reaping in `spawnSSEStream()`

## Verification

1. Start dashboard, start `barf auto`, close the browser tab mid-run
2. Reopen dashboard — orphaned session should show as `crashed` (not `running`)
3. Click "Stop All" — zombie sessions should be cleaned up from the list
4. Run existing tests: `bun test`
