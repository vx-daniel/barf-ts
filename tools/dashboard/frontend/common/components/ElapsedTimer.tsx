/**
 * Live-updating elapsed time display.
 * Ticks every second while active, formats via fmtDuration.
 */
import type React from 'react'
import { useState, useEffect } from 'react'
import Typography from '@mui/material/Typography'
import { fmtDuration } from '@dashboard/frontend/common/utils/format'

interface ElapsedTimerProps {
  startTime: number | null
  label?: string
}

export function ElapsedTimer({
  startTime,
  label,
}: ElapsedTimerProps): React.JSX.Element | null {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (startTime === null) {
      setElapsed(0)
      return
    }

    const tick = (): void => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime])

  if (startTime === null) return null

  return (
    <Typography
      variant="caption"
      sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
    >
      {label ? `${label} ` : ''}
      {fmtDuration(elapsed)}
    </Typography>
  )
}
