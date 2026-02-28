/**
 * Linear progress bar with colour thresholds for context usage.
 */
import type React from 'react'
import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { contextBarColor } from '@dashboard/frontend/common/utils/constants'
import { TOKENS } from '@dashboard/frontend/tokens'

interface ContextBarProps {
  percent: number
  showLabel?: boolean
  height?: number
}

export function ContextBar({
  percent,
  showLabel = false,
  height = 4,
}: ContextBarProps): React.JSX.Element {
  const color = contextBarColor(percent)
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}
    >
      <LinearProgress
        variant="determinate"
        value={clamped}
        sx={{
          flex: 1,
          height,
          borderRadius: height / 2,
          backgroundColor: TOKENS.progressTrack,
          '& .MuiLinearProgress-bar': {
            backgroundColor: color,
            borderRadius: height / 2,
          },
        }}
      />
      {showLabel && (
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', minWidth: 28, textAlign: 'right' }}
        >
          {Math.round(clamped)}%
        </Typography>
      )}
    </Box>
  )
}
