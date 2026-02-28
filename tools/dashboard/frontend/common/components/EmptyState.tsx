/**
 * "No items" placeholder with optional icon and message.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

interface EmptyStateProps {
  icon?: string
  message: string
  submessage?: string
}

export function EmptyState({
  icon,
  message,
  submessage,
}: EmptyStateProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        opacity: 0.6,
      }}
    >
      {icon && (
        <Typography sx={{ fontSize: '1.5rem', mb: 1 }}>{icon}</Typography>
      )}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {message}
      </Typography>
      {submessage && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {submessage}
        </Typography>
      )}
    </Box>
  )
}
