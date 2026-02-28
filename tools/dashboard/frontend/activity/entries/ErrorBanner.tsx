/**
 * Error entry banner for the activity log.
 *
 * Renders `kind: 'error'` entries with a red left-border and truncated preview.
 * Supports expansion to show the full JSON payload for debugging.
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

const TRUNCATE_LENGTH = 80

interface ErrorBannerProps {
  /** The error activity entry to display. */
  entry: ProcessedEntry
}

/**
 * Renders a collapsible error banner for `kind: 'error'` activity entries.
 *
 * The summary line is truncated to {@link TRUNCATE_LENGTH} characters.
 * Expanding reveals the full JSON payload of `entry.data`.
 *
 * @param entry - A {@link ProcessedEntry} with `kind === 'error'`
 * @returns A collapsible error banner element
 */
export function ErrorBanner({ entry }: ErrorBannerProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  let message: string
  if (typeof entry.data.message === 'string') {
    message = entry.data.message
  } else if (typeof entry.data.error === 'string') {
    message = entry.data.error
  } else {
    message = JSON.stringify(entry.data)
  }

  const truncated =
    message.length > TRUNCATE_LENGTH
      ? `${message.slice(0, TRUNCATE_LENGTH)}…`
      : message

  return (
    <Box
      sx={{
        borderLeft: `3px solid ${TOKENS.severityError}`,
        bgcolor: TOKENS.severityErrorBg,
        px: 1,
        py: 0.5,
        fontFamily: 'monospace',
        fontSize: '0.78rem',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          component="span"
          sx={{
            color: TOKENS.severityError,
            fontWeight: 'bold',
            fontSize: '0.7rem',
            border: `1px solid ${TOKENS.severityError}`,
            px: 0.5,
            borderRadius: 0.5,
            mr: 0.5,
            flexShrink: 0,
          }}
        >
          ERROR
        </Typography>
        <Typography
          component="span"
          sx={{
            color: TOKENS.severityErrorText,
            fontSize: 'inherit',
            flex: 1,
            wordBreak: 'break-all',
          }}
        >
          {truncated}
        </Typography>
        <IconButton
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ p: 0.25, color: 'text.secondary' }}
          aria-label={
            expanded ? 'Collapse error details' : 'Expand error details'
          }
        >
          {expanded ? (
            <ExpandLessIcon fontSize="inherit" />
          ) : (
            <ExpandMoreIcon fontSize="inherit" />
          )}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box
          component="pre"
          sx={{
            mt: 0.5,
            p: 0.75,
            bgcolor: TOKENS.surfaceOverlayDark,
            borderRadius: 0.5,
            color: TOKENS.severityErrorText,
            fontSize: '0.72rem',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            m: 0,
          }}
        >
          {JSON.stringify(entry.data, null, 2)}
        </Box>
      </Collapse>
    </Box>
  )
}
