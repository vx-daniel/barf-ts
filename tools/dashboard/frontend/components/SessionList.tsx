/**
 * Session browser panel — left side of the split activity log.
 *
 * Lists running and recent completed sessions. Click to select and view
 * activity detail. Stop button on running sessions sends SIGTERM.
 */

import {
  archiveSessionById,
  deleteSessionById,
  deselectSession,
  selectSession,
  stopSessionByPid,
} from '@dashboard/frontend/lib/actions'
import { icon } from '@dashboard/frontend/lib/constants'
import {
  activeCommand,
  selectedSessionId,
  sessions,
  showArchived,
} from '@dashboard/frontend/lib/state'
import type { Session } from '@dashboard/frontend/lib/types'

const MODE_ICONS: Record<string, string> = {
  plan: 'P',
  build: 'B',
  split: 'S',
  auto: 'A',
  interview: 'I',
}

const STATUS_DOT_COLORS: Record<string, string> = {
  running: 'bg-success animate-pulse',
  crashed: 'bg-error',
  completed: 'bg-base-content/20',
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined) return ''
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function SessionRow({
  session,
  selected,
}: {
  session: Session
  selected: boolean
}) {
  const isRunning = session.status === 'running'

  return (
    <button
      type="button"
      className={`flex items-center gap-sm px-md py-sm cursor-pointer rounded-box text-xs transition-colors w-full text-left bg-transparent text-inherit ${
        selected
          ? 'bg-primary/20 border border-primary/40'
          : 'hover:bg-base-300 border border-transparent'
      }`}
      onClick={() => selectSession(session.sessionId)}
    >
      {/* Mode badge */}
      <span className="badge badge-xs badge-neutral font-mono">
        {MODE_ICONS[session.mode ?? ''] ?? '?'}
      </span>

      {/* Issue ID + info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-xs">
          {session.issueId && (
            <span className="font-mono text-primary truncate">
              #{session.issueId}
            </span>
          )}
          {session.mode === 'auto' && <span className="text-accent">auto</span>}
        </div>
        <div className="text-base-content/40 text-[0.625rem]">
          {timeAgo(session.startedAt)}
          {session.durationSeconds !== undefined &&
            ` \u00b7 ${formatDuration(session.durationSeconds)}`}
        </div>
      </div>

      {/* Status dot */}
      <span
        className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT_COLORS[session.status] ?? 'bg-base-content/20'}`}
        title={session.status}
      />

      {/* Stop button for running sessions */}
      {isRunning && (
        <button
          type="button"
          className="btn btn-xs btn-ghost btn-square text-error"
          title="Stop this session"
          onClick={(e) => {
            e.stopPropagation()
            stopSessionByPid(session.pid)
          }}
        >
          {icon('stop')}
        </button>
      )}

      {/* Archive button for non-archived completed/crashed sessions */}
      {!isRunning && !session.archived && (
        <button
          type="button"
          className="btn btn-xs btn-ghost btn-square text-base-content/30 hover:text-warning"
          title="Archive this session"
          onClick={(e) => {
            e.stopPropagation()
            archiveSessionById(session.sessionId)
          }}
        >
          {icon('archive')}
        </button>
      )}

      {/* Delete button for completed/crashed sessions */}
      {!isRunning && (
        <button
          type="button"
          className="btn btn-xs btn-ghost btn-square text-base-content/30 hover:text-error"
          title="Delete this session"
          onClick={(e) => {
            e.stopPropagation()
            deleteSessionById(session.sessionId)
          }}
        >
          {icon('delete')}
        </button>
      )}
    </button>
  )
}

export function SessionList() {
  const allSessions = sessions.value
  const selected = selectedSessionId.value
  const isShowArchived = showArchived.value

  const running = allSessions.filter((s) => s.status === 'running')
  const runningIds = new Set(running.map((s) => s.sessionId))

  // Active = running sessions + completed/crashed children of running sessions
  const active = allSessions.filter(
    (s) =>
      runningIds.has(s.sessionId) ||
      (s.parentSessionId !== undefined && runningIds.has(s.parentSessionId)),
  )
  const activeIds = new Set(active.map((s) => s.sessionId))

  const archivedSessions = allSessions.filter(
    (s) => !activeIds.has(s.sessionId) && s.archived,
  )
  const recent = allSessions.filter(
    (s) => !activeIds.has(s.sessionId) && !s.archived,
  )

  if (allSessions.length === 0) {
    return (
      <div className="text-base-content/40 text-xs p-md italic">
        No sessions yet. Run a barf command to see sessions here.
      </div>
    )
  }

  const hasLiveStream = activeCommand.value !== null

  return (
    <div className="flex flex-col gap-xs overflow-y-auto">
      {/* Live stream row — returns to the dashboard command output */}
      {hasLiveStream && (
        <button
          type="button"
          className={`flex items-center gap-sm px-md py-sm cursor-pointer rounded-box text-xs transition-colors w-full text-left bg-transparent text-inherit ${
            selected === null
              ? 'bg-primary/20 border border-primary/40'
              : 'hover:bg-base-300 border border-transparent'
          }`}
          onClick={() => deselectSession()}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="font-semibold text-success">
            {activeCommand.value}
          </span>
          <span className="text-base-content/40 text-[0.625rem] ml-auto">
            live
          </span>
        </button>
      )}
      {active.length > 0 && (
        <>
          <div className="text-[0.625rem] uppercase tracking-wider text-success/70 px-md pt-sm font-semibold">
            Active
          </div>
          {active.map((s) => (
            <SessionRow
              key={s.sessionId}
              session={s}
              selected={selected === s.sessionId}
            />
          ))}
        </>
      )}
      {recent.length > 0 && (
        <>
          <div className="text-[0.625rem] uppercase tracking-wider text-base-content/40 px-md pt-sm font-semibold">
            Recent
          </div>
          {recent.map((s) => (
            <SessionRow
              key={s.sessionId}
              session={s}
              selected={selected === s.sessionId}
            />
          ))}
        </>
      )}
      {/* Archived section with toggle */}
      {archivedSessions.length > 0 && (
        <>
          <button
            type="button"
            className="text-[0.625rem] uppercase tracking-wider text-base-content/30 px-md pt-md font-semibold text-left hover:text-base-content/50 transition-colors"
            onClick={() => {
              showArchived.value = !showArchived.value
            }}
          >
            {isShowArchived ? '\u25BC' : '\u25B6'} Archived (
            {archivedSessions.length})
          </button>
          {isShowArchived &&
            archivedSessions.map((s) => (
              <SessionRow
                key={s.sessionId}
                session={s}
                selected={selected === s.sessionId}
              />
            ))}
        </>
      )}
    </div>
  )
}
