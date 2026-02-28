/**
 * Token usage row for the activity log.
 *
 * Renders `kind: 'token_update'` entries as compact +in/+out counters with a
 * magenta border accent. Expanding reveals cache read/write metrics for
 * debugging prompt caching efficiency.
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
import { fmt } from '@dashboard/frontend/common/utils/format'
import { TOKENS } from '@dashboard/frontend/tokens'

interface TokenRowProps {
  /** The token_update activity entry to render. */
  entry: ProcessedEntry
}

/**
 * Renders a compact token count row for `kind: 'token_update'` entries.
 *
 * Summary shows `+N in, +N out`. Expansion reveals cache hit/write breakdown
 * from `entry.data` if present.
 *
 * @param entry - A {@link ProcessedEntry} with `kind === 'token_update'`
 * @returns A collapsible token row element
 */
export function TokenRow({ entry }: TokenRowProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const inputTokens =
    typeof entry.data.inputTokens === 'number' ? entry.data.inputTokens : 0
  const outputTokens =
    typeof entry.data.outputTokens === 'number' ? entry.data.outputTokens : 0
  const cacheRead =
    typeof entry.data.cacheReadInputTokens === 'number'
      ? entry.data.cacheReadInputTokens
      : 0
  const cacheWrite =
    typeof entry.data.cacheCreationInputTokens === 'number'
      ? entry.data.cacheCreationInputTokens
      : 0

  const hasCacheData = cacheRead > 0 || cacheWrite > 0

  return (
    <Box
      sx={{
        borderLeft: `2px solid ${TOKENS.tokenAccent}`,
        px: 1,
        py: 0.25,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: TOKENS.tokenBg,
      }}
    >
      <Typography
        component="span"
        sx={{
          color: TOKENS.tokenAccent,
          fontWeight: 'bold',
          fontSize: '0.68rem',
          border: `1px solid ${TOKENS.tokenAccent}`,
          px: 0.5,
          borderRadius: 0.5,
          flexShrink: 0,
        }}
      >
        TOKENS
      </Typography>
      <Typography
        component="span"
        sx={{ color: TOKENS.tokenInput, fontSize: 'inherit' }}
      >
        +{fmt(inputTokens)} in
      </Typography>
      <Typography
        component="span"
        sx={{ color: 'text.disabled', fontSize: 'inherit' }}
      >
        ·
      </Typography>
      <Typography
        component="span"
        sx={{ color: TOKENS.tokenOutput, fontSize: 'inherit' }}
      >
        +{fmt(outputTokens)} out
      </Typography>

      {hasCacheData && (
        <IconButton
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ p: 0.25, color: 'text.secondary', ml: 'auto' }}
          aria-label={expanded ? 'Hide cache metrics' : 'Show cache metrics'}
        >
          {expanded ? (
            <ExpandLessIcon fontSize="inherit" />
          ) : (
            <ExpandMoreIcon fontSize="inherit" />
          )}
        </IconButton>
      )}

      <Collapse in={expanded} sx={{ width: '100%' }}>
        <Box sx={{ pt: 0.5, display: 'flex', gap: 2 }}>
          <Typography
            component="span"
            sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
          >
            cache read: <strong>{fmt(cacheRead)}</strong>
          </Typography>
          <Typography
            component="span"
            sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
          >
            cache write: <strong>{fmt(cacheWrite)}</strong>
          </Typography>
        </Box>
      </Collapse>
    </Box>
  )
}
