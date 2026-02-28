/**
 * Issue state chip with colour, label, and optional emoji.
 * Single source of truth for state rendering across all panels.
 */
import type React from 'react'
import Chip from '@mui/material/Chip'
import type { IssueState } from '@/types/schema/issue-schema'
import {
  stateColor,
  stateEmoji,
  STATE_LABELS,
} from '@dashboard/frontend/common/utils/constants'

interface StateBadgeProps {
  state: IssueState | string
  size?: 'small' | 'medium'
  showEmoji?: boolean
}

export function StateBadge({
  state,
  size = 'small',
  showEmoji = true,
}: StateBadgeProps): React.JSX.Element {
  const color = stateColor(state)
  const label = STATE_LABELS[state as IssueState] ?? state
  const emoji = showEmoji ? stateEmoji(state) : ''

  return (
    <Chip
      label={`${emoji} ${label}`.trim()}
      size={size}
      sx={{
        backgroundColor: `${color}22`,
        color,
        borderColor: `${color}44`,
        border: '1px solid',
        fontWeight: 600,
        fontSize: size === 'small' ? '0.625rem' : '0.6875rem',
      }}
    />
  )
}
