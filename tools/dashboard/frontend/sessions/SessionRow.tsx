/**
 * Individual session row for {@link SessionList}.
 *
 * Renders mode badge, issue ID, time info, status indicator, and action
 * buttons (stop / archive / delete) for a single {@link Session}. Selecting
 * the row calls {@link useSessionStore.selectSession} via the parent's onClick
 * delegation.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { Session } from '@/types/schema/session-index-schema'
import { useSessionStore } from '@dashboard/frontend/store/useSessionStore'
import { CMD_PALETTE, STATE_PALETTE } from '@dashboard/frontend/theme'
import { TOKENS } from '@dashboard/frontend/tokens'

/** Single-letter badge label per session mode. */
const MODE_LABELS: Record<string, string> = {
  plan: 'P',
  build: 'B',
  split: 'S',
  auto: 'A',
  interview: 'I',
}

/** Accent colour per session mode for the badge chip — sourced from {@link CMD_PALETTE}. */
const MODE_COLORS: Record<string, string> = {
  plan: CMD_PALETTE.plan,
  build: CMD_PALETTE.build,
  split: STATE_PALETTE.split,
  auto: CMD_PALETTE.triage,
  interview: CMD_PALETTE.interview,
}

/**
 * Formats a duration in seconds as a human-readable short string.
 *
 * @param seconds - Total elapsed seconds, or undefined if still running
 * @returns Formatted string like "42s", "3m 12s", or empty string if undefined
 */
function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined) return ''
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/**
 * Formats an ISO timestamp as a relative "time ago" string.
 *
 * @param iso - ISO 8601 date string
 * @returns Human-readable string like "5s ago", "3m ago", "2h ago", "1d ago"
 */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface SessionRowProps {
  /** The session data to display. */
  session: Session
  /** Whether this row is currently selected in the session list. */
  selected: boolean
}

/**
 * Single session row component.
 *
 * Renders mode chip, issue ID, timestamps, status dot and action buttons.
 * Clicking the row body selects the session; action buttons stop propagation
 * to prevent unintended selection.
 *
 * @returns A clickable row box with session metadata and action controls.
 */
export function SessionRow({
  session,
  selected,
}: SessionRowProps): React.JSX.Element {
  const selectSession = useSessionStore((s) => s.selectSession)
  const stopSession = useSessionStore((s) => s.stopSession)
  const archiveSession = useSessionStore((s) => s.archiveSession)
  const deleteSession = useSessionStore((s) => s.deleteSession)

  const isRunning = session.status === 'running'
  const modeLabel = MODE_LABELS[session.mode ?? ''] ?? '?'
  const modeColor = MODE_COLORS[session.mode ?? ''] ?? STATE_PALETTE.new

  const STATUS_DOT_COLORS: Record<string, string> = {
    running: TOKENS.statusRunning,
    crashed: TOKENS.statusCrashed,
  }
  const statusDotColor =
    STATUS_DOT_COLORS[session.status] ?? TOKENS.statusInactive

  const duration = formatDuration(session.durationSeconds)

  return (
    <Box
      onClick={() => selectSession(session.sessionId)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: selected ? TOKENS.sessionSelectedBorder : 'transparent',
        backgroundColor: selected ? TOKENS.sessionSelectedBg : 'transparent',
        '&:hover': {
          backgroundColor: selected
            ? TOKENS.sessionSelectedHover
            : TOKENS.sessionHover,
        },
        transition: 'background-color 0.15s, border-color 0.15s',
      }}
    >
      {/* Mode badge */}
      <Chip
        label={modeLabel}
        size="small"
        sx={{
          height: 18,
          fontSize: '0.625rem',
          fontFamily: 'monospace',
          fontWeight: 700,
          backgroundColor: `${modeColor}22`,
          color: modeColor,
          border: `1px solid ${modeColor}44`,
          '& .MuiChip-label': { px: 0.75 },
          flexShrink: 0,
        }}
      />

      {/* Issue ID + timestamps */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {session.issueId && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'monospace',
                color: 'primary.main',
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              #{session.issueId}
            </Typography>
          )}
          {session.mode === 'auto' && (
            <Typography
              variant="caption"
              sx={{
                color: MODE_COLORS.auto,
                fontSize: '0.625rem',
                lineHeight: 1.2,
              }}
            >
              auto
            </Typography>
          )}
        </Box>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.625rem',
            lineHeight: 1.2,
            display: 'block',
          }}
        >
          {timeAgo(session.startedAt)}
          {duration && ` · ${duration}`}
        </Typography>
      </Box>

      {/* Status dot — pulsing animation for running sessions */}
      <Box
        title={session.status}
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: statusDotColor,
          flexShrink: 0,
          ...(isRunning && {
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.4 },
            },
          }),
        }}
      />

      {/* Stop button — only for running sessions */}
      {isRunning && (
        <Tooltip title="Stop session">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              void stopSession(session.pid)
            }}
            sx={{
              color: 'error.main',
              opacity: 0.7,
              p: 0.25,
              '&:hover': { opacity: 1 },
            }}
          >
            <Box component="span" sx={{ fontSize: '0.75rem', lineHeight: 1 }}>
              ⏹
            </Box>
          </IconButton>
        </Tooltip>
      )}

      {/* Archive button — non-archived completed/crashed sessions */}
      {!isRunning && !session.archived && (
        <Tooltip title="Archive session">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              void archiveSession(session.sessionId)
            }}
            sx={{
              color: 'text.secondary',
              opacity: 0.4,
              p: 0.25,
              '&:hover': { opacity: 1, color: 'warning.main' },
            }}
          >
            <Box component="span" sx={{ fontSize: '0.75rem', lineHeight: 1 }}>
              📦
            </Box>
          </IconButton>
        </Tooltip>
      )}

      {/* Delete button — all non-running sessions */}
      {!isRunning && (
        <Tooltip title="Delete session">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              void deleteSession(session.sessionId)
            }}
            sx={{
              color: 'text.secondary',
              opacity: 0.4,
              p: 0.25,
              '&:hover': { opacity: 1, color: 'error.main' },
            }}
          >
            <Box component="span" sx={{ fontSize: '0.75rem', lineHeight: 1 }}>
              🗑️
            </Box>
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )
}
