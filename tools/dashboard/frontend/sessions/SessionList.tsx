/**
 * Session browser panel — left side of the split activity log.
 *
 * Lists a "Live" row when a command is actively running, followed by Active
 * sessions (running + children of running), Recent sessions (non-archived,
 * non-active), and a toggleable Archived section. Click a row to select it and
 * view its activity stream; click the Live row to return to the live dashboard
 * feed via {@link useSessionStore.deselectSession}.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useSessionStore } from '@dashboard/frontend/store/useSessionStore'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { TOKENS } from '@dashboard/frontend/tokens'
import { SessionRow } from '@dashboard/frontend/sessions/SessionRow'

/**
 * Session browser with live, active, recent, and archived sections.
 *
 * Derives section membership from the store each render:
 * - **Live**: shown when {@link useIssueStore.activeCommand} is set; clicking deselects any session.
 * - **Active**: running sessions plus completed/crashed children of a running parent.
 * - **Recent**: non-active, non-archived sessions.
 * - **Archived**: hidden until the user toggles the section header.
 *
 * @returns The rendered session list, or an empty-state message when no sessions exist.
 */
export function SessionList(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId)
  const showArchived = useSessionStore((s) => s.showArchived)
  const deselectSession = useSessionStore((s) => s.deselectSession)
  const setShowArchived = useSessionStore((s) => s.setShowArchived)
  const activeCommand = useIssueStore((s) => s.activeCommand)

  const running = sessions.filter((s) => s.status === 'running')
  const runningIds = new Set(running.map((s) => s.sessionId))

  // Active = running + completed/crashed children of a still-running parent
  const active = sessions.filter(
    (s) =>
      runningIds.has(s.sessionId) ||
      (s.parentSessionId !== undefined && runningIds.has(s.parentSessionId)),
  )
  const activeIds = new Set(active.map((s) => s.sessionId))

  const archived = sessions.filter(
    (s) => !activeIds.has(s.sessionId) && s.archived,
  )
  const recent = sessions.filter(
    (s) => !activeIds.has(s.sessionId) && !s.archived,
  )

  const hasLiveStream = activeCommand !== null

  if (sessions.length === 0) {
    return (
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          p: 1.5,
          display: 'block',
          fontStyle: 'italic',
        }}
      >
        No sessions yet. Run a barf command to see sessions here.
      </Typography>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        overflowY: 'auto',
      }}
    >
      {/* Live stream row — returns to dashboard command output */}
      {hasLiveStream && (
        <Box
          onClick={() => deselectSession()}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            border: '1px solid',
            borderColor:
              selectedSessionId === null
                ? TOKENS.sessionSelectedBorder
                : 'transparent',
            backgroundColor:
              selectedSessionId === null
                ? TOKENS.sessionSelectedBg
                : 'transparent',
            '&:hover': {
              backgroundColor:
                selectedSessionId === null
                  ? TOKENS.sessionSelectedHover
                  : TOKENS.sessionHover,
            },
            transition: 'background-color 0.15s, border-color 0.15s',
          }}
        >
          {/* Pulsing green dot */}
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: TOKENS.statusRunning,
              flexShrink: 0,
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.4 },
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: TOKENS.statusRunning, fontWeight: 600, flex: 1 }}
          >
            {activeCommand}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontSize: '0.625rem' }}
          >
            live
          </Typography>
        </Box>
      )}

      {/* Active section */}
      {active.length > 0 && (
        <>
          <SectionLabel color={TOKENS.statusRunning}>Active</SectionLabel>
          {active.map((s) => (
            <SessionRow
              key={s.sessionId}
              session={s}
              selected={selectedSessionId === s.sessionId}
            />
          ))}
        </>
      )}

      {/* Recent section */}
      {recent.length > 0 && (
        <>
          <SectionLabel>Recent</SectionLabel>
          {recent.map((s) => (
            <SessionRow
              key={s.sessionId}
              session={s}
              selected={selectedSessionId === s.sessionId}
            />
          ))}
        </>
      )}

      {/* Archived section with toggle */}
      {archived.length > 0 && (
        <>
          <Box
            component="button"
            onClick={() => setShowArchived(!showArchived)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              pt: 1,
              pb: 0.25,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'text.secondary',
              opacity: 0.5,
              fontSize: '0.625rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              '&:hover': { opacity: 0.8 },
              transition: 'opacity 0.15s',
            }}
          >
            <span>{showArchived ? '▼' : '▶'}</span>
            <span>Archived ({archived.length})</span>
          </Box>
          {showArchived &&
            archived.map((s) => (
              <SessionRow
                key={s.sessionId}
                session={s}
                selected={selectedSessionId === s.sessionId}
              />
            ))}
        </>
      )}
    </Box>
  )
}

/** Small section-label divider shared within {@link SessionList}. */
function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode
  color?: string
}): React.JSX.Element {
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        px: 1,
        pt: 0.75,
        pb: 0.125,
        fontSize: '0.625rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: color ?? 'text.secondary',
        opacity: color ? 0.7 : 0.5,
      }}
    >
      {children}
    </Typography>
  )
}
