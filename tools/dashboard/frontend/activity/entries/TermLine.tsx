/**
 * Synthetic terminal line renderer for logTerm() entries.
 *
 * Displays terminal messages emitted by {@link useActivityStore.logTerm} with
 * visual differentiation by type (info / done / error). These entries use
 * `kind: 'stdout'` but carry a `termType` discriminator to distinguish them
 * from real Claude stdout lines.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ProcessedEntry } from '@dashboard/frontend/store/useActivityStore'
import { TOKENS } from '@dashboard/frontend/tokens'

interface TermLineProps {
  /** The synthetic terminal entry to render. */
  entry: ProcessedEntry
}

/** Colour and prefix lookup keyed by termType value. */
const TERM_STYLES: Record<string, { color: string; prefix: string }> = {
  info: { color: TOKENS.logInfo, prefix: 'ℹ' },
  done: { color: TOKENS.logDone, prefix: '✓' },
  error: { color: TOKENS.logError, prefix: '✗' },
  warn: { color: TOKENS.logWarn, prefix: '⚠' },
}

const FALLBACK_STYLE = { color: TOKENS.logFallback, prefix: '·' }

/**
 * Renders a single synthetic terminal line produced by {@link useActivityStore.logTerm}.
 *
 * @param entry - A {@link ProcessedEntry} with `termType` and `termText` fields set
 * @returns A styled terminal line element
 */
export function TermLine({ entry }: TermLineProps): React.JSX.Element {
  const style = TERM_STYLES[entry.termType ?? ''] ?? FALLBACK_STYLE

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.25,
        fontFamily: 'monospace',
        fontSize: '0.78rem',
        borderLeft: `2px solid ${style.color}`,
        bgcolor: 'background.paper',
        opacity: 0.9,
      }}
    >
      <Typography
        component="span"
        sx={{
          color: style.color,
          fontWeight: 'bold',
          minWidth: 14,
          fontSize: 'inherit',
        }}
      >
        {style.prefix}
      </Typography>
      <Typography
        component="span"
        sx={{ color: 'text.primary', fontSize: 'inherit', flex: 1 }}
      >
        {entry.termText ?? ''}
      </Typography>
    </Box>
  )
}
