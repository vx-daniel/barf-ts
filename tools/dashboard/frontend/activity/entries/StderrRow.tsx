/**
 * Stderr log line renderer for the activity log.
 *
 * Parses pino-formatted JSON log lines and displays them with colour-coded
 * level badges. Falls back to raw text rendering for non-JSON stderr output.
 *
 * Pino log levels: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ProcessedEntry } from '@dashboard/frontend/store/useActivityStore'
import { TOKENS } from '@dashboard/frontend/tokens'

interface StderrRowProps {
  /** The stderr activity entry to render. */
  entry: ProcessedEntry
}

interface PinoLog {
  level: number
  name?: string
  msg?: string
  time?: number
  [key: string]: unknown
}

/** Pino numeric level → badge label + colour. */
const LEVEL_META: Record<number, { label: string; color: string }> = {
  10: { label: 'TRACE', color: TOKENS.logTrace },
  20: { label: 'DEBUG', color: TOKENS.logDebug },
  30: { label: 'INFO', color: TOKENS.logInfo },
  40: { label: 'WARN', color: TOKENS.logWarn },
  50: { label: 'ERROR', color: TOKENS.logError },
  60: { label: 'FATAL', color: TOKENS.logFatal },
}

const PINO_RESERVED = new Set([
  'level',
  'time',
  'pid',
  'hostname',
  'name',
  'msg',
  'v',
])

/** Attempts to parse a line as a pino JSON log. Returns null if not valid pino. */
function parsePino(raw: string): PinoLog | null {
  if (!raw.startsWith('{')) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (typeof parsed.level !== 'number') return null
    return parsed as PinoLog
  } catch {
    return null
  }
}

/**
 * Renders a single stderr activity entry.
 *
 * If the `line` field in `entry.data` is valid pino JSON, shows a coloured
 * level badge, optional logger name, message, and any extra structured fields.
 * Otherwise renders the raw line text.
 *
 * @param entry - A {@link ProcessedEntry} with `kind === 'stderr'`
 * @returns A formatted stderr row element
 */
export function StderrRow({ entry }: StderrRowProps): React.JSX.Element {
  const raw =
    typeof entry.data.line === 'string'
      ? entry.data.line
      : JSON.stringify(entry.data)
  const pino = parsePino(raw)

  if (pino === null) {
    return (
      <Box
        sx={{
          px: 1,
          py: 0.15,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: TOKENS.stderrText,
          borderLeft: `2px solid ${TOKENS.borderStderrFallback}`,
          wordBreak: 'break-all',
        }}
      >
        {raw}
      </Box>
    )
  }

  const meta = LEVEL_META[pino.level] ?? {
    label: String(pino.level),
    color: TOKENS.logMuted,
  }
  const extras = Object.entries(pino)
    .filter(([k]) => !PINO_RESERVED.has(k))
    .map(
      ([k, v]) =>
        `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`,
    )
    .join(' ')

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 0.75,
        px: 1,
        py: 0.15,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        borderLeft: `2px solid ${meta.color}`,
        bgcolor: TOKENS.surfaceOverlayLight,
      }}
    >
      <Typography
        component="span"
        sx={{
          color: meta.color,
          fontWeight: 'bold',
          fontSize: '0.68rem',
          border: `1px solid ${meta.color}`,
          px: 0.4,
          borderRadius: 0.5,
          flexShrink: 0,
          lineHeight: 1.4,
        }}
      >
        {meta.label}
      </Typography>

      {pino.name !== undefined && (
        <Typography
          component="span"
          sx={{ color: TOKENS.stderrNameTag, fontSize: 'inherit' }}
        >
          [{pino.name}]
        </Typography>
      )}

      <Typography
        component="span"
        sx={{ color: 'text.primary', fontSize: 'inherit', flex: 1 }}
      >
        {pino.msg ?? ''}
      </Typography>

      {extras.length > 0 && (
        <Typography
          component="span"
          sx={{
            color: 'text.disabled',
            fontSize: '0.7rem',
            wordBreak: 'break-all',
          }}
        >
          {extras}
        </Typography>
      )}
    </Box>
  )
}
