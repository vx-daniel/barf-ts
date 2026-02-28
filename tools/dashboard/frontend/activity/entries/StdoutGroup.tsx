/**
 * Collapsible group of consecutive stdout activity entries.
 *
 * Consecutive `kind: 'stdout'` entries are grouped visually to reduce noise.
 * State-transition lines (`__BARF_STATE__:`) are rendered as amber banners.
 * JSON content is pretty-printed for readability.
 */
import type React from 'react'
import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import type { ProcessedEntry } from '@dashboard/frontend/store/useActivityStore'
import { TOKENS } from '@dashboard/frontend/tokens'

interface StdoutGroupProps {
  /** Consecutive stdout entries belonging to this visual group. */
  entries: ProcessedEntry[]
  /** Default open state — panels auto-expand when streaming. */
  defaultOpen?: boolean
}

const BARF_STATE_PREFIX = '__BARF_STATE__:'

/** Formats an HH:MM:SS timestamp string from a unix millisecond value. */
function toHMS(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

/** Tries to pretty-print JSON content; returns null if not JSON. */
function tryPrettyJson(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return null
  }
}

interface StdoutLineProps {
  entry: ProcessedEntry
}

/** Renders a single stdout line, with special handling for state banners and JSON. */
function StdoutLine({ entry }: StdoutLineProps): React.JSX.Element {
  const line =
    typeof entry.data.line === 'string'
      ? entry.data.line
      : (entry.termText ?? '')

  if (line.startsWith(BARF_STATE_PREFIX)) {
    const state = line.slice(BARF_STATE_PREFIX.length).trim()
    return (
      <Box
        sx={{
          px: 1,
          py: 0.5,
          bgcolor: TOKENS.severityWarnBg,
          borderLeft: `3px solid ${TOKENS.severityWarnBanner}`,
          fontFamily: 'monospace',
          fontSize: '0.78rem',
          color: TOKENS.severityWarnBanner,
          fontWeight: 'bold',
        }}
      >
        ▶ STATE: {state}
      </Box>
    )
  }

  const pretty = tryPrettyJson(line)
  if (pretty !== null) {
    return (
      <Box
        component="pre"
        sx={{
          px: 1,
          py: 0.25,
          m: 0,
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          color: TOKENS.codeMutedText,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        <Typography
          component="span"
          sx={{ color: 'text.disabled', fontSize: '0.68rem', mr: 1 }}
        >
          {toHMS(entry.timestamp)}
        </Typography>
        {pretty}
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        px: 1,
        py: 0.1,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        alignItems: 'baseline',
      }}
    >
      <Typography
        component="span"
        sx={{ color: 'text.disabled', fontSize: '0.68rem', flexShrink: 0 }}
      >
        {toHMS(entry.timestamp)}
      </Typography>
      <Typography
        component="span"
        sx={{
          color: 'text.primary',
          fontSize: 'inherit',
          flex: 1,
          wordBreak: 'break-all',
        }}
      >
        {line}
      </Typography>
    </Box>
  )
}

/**
 * Renders a collapsible group of consecutive stdout entries from the same session.
 *
 * The summary header shows issue context, line count, and timestamp of the last entry.
 * Expanding reveals individual {@link StdoutLine} rows.
 *
 * @param entries - Non-empty array of consecutive `kind === 'stdout'` entries
 * @param defaultOpen - Whether the group starts expanded (default: `false`)
 * @returns A collapsible group element
 */
export function StdoutGroup({
  entries,
  defaultOpen = false,
}: StdoutGroupProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)

  const first = entries[0]
  const last = entries[entries.length - 1]
  const issueLabel = first?.issueId != null ? `#${first.issueId}` : ''
  const lineCount = entries.length
  const timestamp = last !== undefined ? toHMS(last.timestamp) : ''

  return (
    <Box sx={{ borderLeft: `2px solid ${TOKENS.borderCodeGroup}` }}>
      <Box
        component="button"
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          px: 1,
          py: 0.25,
          bgcolor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'text.secondary',
          '&:hover': { bgcolor: TOKENS.surfaceHover },
        }}
      >
        <Typography
          component="span"
          sx={{ color: TOKENS.stderrGroupBullet, fontSize: 'inherit' }}
        >
          ◦
        </Typography>
        <Typography
          component="span"
          sx={{ color: 'text.secondary', fontSize: 'inherit', flex: 1 }}
        >
          Claude output
          {issueLabel !== '' && (
            <>
              {' · '}
              <strong>{issueLabel}</strong>
            </>
          )}
          {' · '}
          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          {' · '}
          {timestamp}
        </Typography>
        <IconButton
          component="span"
          size="small"
          sx={{ p: 0.25, color: 'text.disabled', pointerEvents: 'none' }}
          aria-label={open ? 'Collapse output' : 'Expand output'}
        >
          {open ? (
            <ExpandLessIcon fontSize="inherit" />
          ) : (
            <ExpandMoreIcon fontSize="inherit" />
          )}
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Box>
          {entries.map((e) => (
            <StdoutLine key={e.key} entry={e} />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
