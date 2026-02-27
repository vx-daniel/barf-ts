/**
 * Session service — reads `.barf/sessions.jsonl` and provides merged session views.
 *
 * Parses the append-only session index into a list of {@link Session} objects,
 * merging start/end events by `sessionId`. For sessions without an `end` event,
 * checks PID liveness to determine `running` vs `crashed` status.
 */
import { appendFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type {
  Session,
  SessionIndexEvent,
} from '@/types/schema/session-index-schema'
import { SessionIndexEventSchema } from '@/types/schema/session-index-schema'

/**
 * Checks whether a process with the given PID is still alive.
 *
 * @param pid - Process ID to check.
 * @returns `true` if the process is alive.
 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    // kill(0) succeeds on zombie processes — check /proc to detect them
    if (existsSync(`/proc/${pid}/status`)) {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8')
      if (/^State:\s+Z/m.test(status)) return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Reads and parses all events from the session index file.
 *
 * @param barfDir - Absolute path to the `.barf` directory.
 * @returns Parsed session index events (invalid lines are silently skipped).
 */
function readEvents(barfDir: string): SessionIndexEvent[] {
  const indexPath = join(barfDir, 'sessions.jsonl')
  let content: string
  try {
    content = readFileSync(indexPath, 'utf8')
  } catch {
    return []
  }

  const events: SessionIndexEvent[] = []
  for (const line of content.split('\n')) {
    if (!line.trim()) continue
    try {
      const parsed = SessionIndexEventSchema.safeParse(JSON.parse(line))
      if (parsed.success) {
        events.push(parsed.data)
      }
    } catch {
      // Skip malformed lines
    }
  }
  return events
}

/**
 * Returns a list of sessions merged from the session index.
 *
 * Sessions without an `end` event have their PID checked for liveness.
 * Auto sessions include `children` arrays linking to child issue sessions.
 *
 * @param barfDir - Absolute path to the `.barf` directory.
 * @param limit - Maximum number of recent completed sessions to return (default 50).
 * @returns Merged sessions sorted by start time descending.
 */
export function listSessions(barfDir: string, limit = 50): Session[] {
  const events = readEvents(barfDir)
  const sessions = new Map<string, Session>()
  const deleted = new Set<string>()
  const archived = new Set<string>()

  // Collect deleted and archived session IDs first
  for (const event of events) {
    if (event.event === 'delete') deleted.add(event.sessionId)
    if (event.event === 'archive') archived.add(event.sessionId)
  }

  for (const event of events) {
    if (event.event === 'delete' || event.event === 'archive') continue
    if (deleted.has(event.sessionId)) continue

    if (event.event === 'start') {
      sessions.set(event.sessionId, {
        sessionId: event.sessionId,
        pid: event.pid,
        issueId: event.issueId,
        mode: event.mode,
        model: event.model,
        startedAt: event.timestamp,
        status: 'running',
        streamOffset: event.streamOffset,
        parentSessionId: event.parentSessionId,
      })
    } else if (event.event === 'end') {
      const existing = sessions.get(event.sessionId)
      if (existing) {
        existing.endedAt = event.timestamp
        existing.status = 'completed'
        existing.streamEndOffset = event.streamEndOffset
        existing.inputTokens = event.inputTokens
        existing.outputTokens = event.outputTokens
        existing.iterations = event.iterations
        existing.durationSeconds = event.durationSeconds
      }
    } else if (event.event === 'auto_start') {
      sessions.set(event.sessionId, {
        sessionId: event.sessionId,
        pid: event.pid,
        mode: 'auto',
        startedAt: event.timestamp,
        status: 'running',
        children: [],
      })
    } else if (event.event === 'auto_end') {
      const existing = sessions.get(event.sessionId)
      if (existing) {
        existing.endedAt = event.timestamp
        existing.status = 'completed'
        existing.durationSeconds = Math.floor(
          (new Date(event.timestamp).getTime() -
            new Date(existing.startedAt).getTime()) /
            1000,
        )
      }
    }
  }

  // Mark archived sessions
  for (const id of archived) {
    const session = sessions.get(id)
    if (session) session.archived = true
  }

  // Resolve parent-child relationships and PID liveness
  for (const session of sessions.values()) {
    if (session.parentSessionId) {
      const parent = sessions.get(session.parentSessionId)
      if (parent?.children) {
        parent.children.push(session.sessionId)
      }
    }

    if (!session.endedAt) {
      session.status = isPidAlive(session.pid) ? 'running' : 'crashed'
    }
  }

  // Sort by start time descending
  const all = [...sessions.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )

  // Return all running + limited recent completed
  const running = all.filter((s) => s.status === 'running')
  const completed = all.filter((s) => s.status !== 'running').slice(0, limit)

  return [...running, ...completed]
}

/**
 * Attempts to stop a session by sending SIGTERM to its PID.
 *
 * Validates the PID exists in the session index before killing.
 *
 * @param barfDir - Absolute path to the `.barf` directory.
 * @param pid - PID to stop.
 * @returns `true` if the signal was sent, `false` if PID not found or already dead.
 */
export function stopSession(barfDir: string, pid: number): boolean {
  const events = readEvents(barfDir)
  const knownPids = new Set(events.flatMap((e) => ('pid' in e ? [e.pid] : [])))

  if (!knownPids.has(pid)) {
    return false
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // Already dead — fall through to mark ended
  }

  // If the process is a zombie or already dead, write end events so the
  // session index no longer considers it "running".
  if (!isPidAlive(pid)) {
    markSessionsEnded(barfDir, pid, events)
  }

  return true
}

/**
 * Writes `end` / `auto_end` events for all open sessions belonging to a dead PID.
 *
 * This cleans up the session index when a process exits without writing its own
 * end events (e.g. zombies, crashes, or killed-without-cleanup scenarios).
 *
 * @param barfDir - Absolute path to the `.barf` directory.
 * @param pid - The dead PID whose sessions should be closed.
 * @param events - Pre-read session index events.
 */
function markSessionsEnded(
  barfDir: string,
  pid: number,
  events: SessionIndexEvent[],
): void {
  const indexPath = join(barfDir, 'sessions.jsonl')
  const now = new Date().toISOString()

  // Find session IDs that started with this PID but never ended
  const started = new Set<string>()
  const ended = new Set<string>()
  const autoStarted = new Set<string>()
  const autoEnded = new Set<string>()

  for (const e of events) {
    if (e.event === 'start' && e.pid === pid) started.add(e.sessionId)
    if (e.event === 'end' && e.pid === pid) ended.add(e.sessionId)
    if (e.event === 'auto_start' && e.pid === pid) autoStarted.add(e.sessionId)
    if (e.event === 'auto_end' && e.pid === pid) autoEnded.add(e.sessionId)
  }

  const lines: string[] = []

  for (const sessionId of started) {
    if (!ended.has(sessionId)) {
      lines.push(
        JSON.stringify({ event: 'end', sessionId, pid, timestamp: now }),
      )
    }
  }

  for (const sessionId of autoStarted) {
    if (!autoEnded.has(sessionId)) {
      lines.push(
        JSON.stringify({ event: 'auto_end', sessionId, pid, timestamp: now }),
      )
    }
  }

  if (lines.length > 0) {
    appendFileSync(indexPath, lines.map((l) => `${l}\n`).join(''))
  }
}

/**
 * Deletes a session by appending a `delete` event to the index.
 *
 * Running sessions cannot be deleted — stop them first.
 *
 * @param barfDir - Absolute path to the `.barf` directory.
 * @param sessionId - Session ID to delete.
 * @returns `true` if the delete event was written, `false` if session not found or still running.
 */
export function deleteSession(barfDir: string, sessionId: string): boolean {
  const sessions = listSessions(barfDir)
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) return false
  if (session.status === 'running') return false

  const event = {
    event: 'delete',
    sessionId,
    timestamp: new Date().toISOString(),
  }
  const indexPath = join(barfDir, 'sessions.jsonl')
  appendFileSync(indexPath, `${JSON.stringify(event)}\n`)
  return true
}

/**
 * Archives a session by appending an `archive` event to the index.
 *
 * Running sessions cannot be archived — stop them first.
 *
 * @param barfDir - Absolute path to the `.barf` directory.
 * @param sessionId - Session ID to archive.
 * @returns `true` if the archive event was written, `false` if session not found or still running.
 */
export function archiveSession(barfDir: string, sessionId: string): boolean {
  const sessions = listSessions(barfDir)
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) return false
  if (session.status === 'running') return false

  const event = {
    event: 'archive',
    sessionId,
    timestamp: new Date().toISOString(),
  }
  const indexPath = join(barfDir, 'sessions.jsonl')
  appendFileSync(indexPath, `${JSON.stringify(event)}\n`)
  return true
}
