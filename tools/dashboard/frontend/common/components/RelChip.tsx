/**
 * Clickable chip for parent/child issue navigation.
 */
import type React from 'react'
import Chip from '@mui/material/Chip'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'

interface RelChipProps {
  issueId: string
  label: string
  variant?: 'parent' | 'child'
}

export function RelChip({
  issueId,
  label,
  variant = 'child',
}: RelChipProps): React.JSX.Element {
  const navigateToIssue = useIssueStore((s) => s.navigateToIssue)

  return (
    <Chip
      label={`${variant === 'parent' ? '\u2191' : '\u2193'} ${label}`}
      size="small"
      onClick={() => navigateToIssue(issueId)}
      sx={{
        cursor: 'pointer',
        fontSize: '0.625rem',
        height: 20,
        '&:hover': { opacity: 0.8 },
      }}
    />
  )
}
