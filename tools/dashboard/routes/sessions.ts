/**
 * Session API routes — list sessions and stop running processes.
 */
import type { IssueService } from '@dashboard/services/issue-service'
import {
  archiveSession,
  deleteSession,
  listSessions,
  stopSession,
} from '@dashboard/services/session-service'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
} as const

/**
 * `GET /api/sessions` — returns merged session list.
 */
export function handleListSessions(svc: IssueService): Response {
  const sessions = listSessions(svc.barfDir)
  return new Response(JSON.stringify(sessions), { headers: JSON_HEADERS })
}

/**
 * `POST /api/sessions/:pid/stop` — sends SIGTERM to a running session.
 */
export function handleStopSession(svc: IssueService, pid: number): Response {
  const stopped = stopSession(svc.barfDir, pid)
  if (!stopped) {
    return new Response(
      JSON.stringify({ error: 'PID not found or already stopped' }),
      { status: 404, headers: JSON_HEADERS },
    )
  }
  return new Response(JSON.stringify({ stopped: true, pid }), {
    headers: JSON_HEADERS,
  })
}

/**
 * `DELETE /api/sessions/:sessionId` — deletes a completed/crashed session.
 */
export function handleDeleteSession(
  svc: IssueService,
  sessionId: string,
): Response {
  const deleted = deleteSession(svc.barfDir, sessionId)
  if (!deleted) {
    return new Response(
      JSON.stringify({
        error: 'Session not found, still running, or already deleted',
      }),
      { status: 400, headers: JSON_HEADERS },
    )
  }
  return new Response(JSON.stringify({ deleted: true, sessionId }), {
    headers: JSON_HEADERS,
  })
}

/**
 * `POST /api/sessions/:sessionId/archive` — archives a completed/crashed session.
 */
export function handleArchiveSession(
  svc: IssueService,
  sessionId: string,
): Response {
  const result = archiveSession(svc.barfDir, sessionId)
  if (!result) {
    return new Response(
      JSON.stringify({
        error: 'Session not found, still running, or already archived',
      }),
      { status: 400, headers: JSON_HEADERS },
    )
  }
  return new Response(JSON.stringify({ archived: true, sessionId }), {
    headers: JSON_HEADERS,
  })
}
