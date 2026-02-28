/**
 * A single state column in the kanban board.
 * STUCK column absorbs SPLIT issues — both are "blocked" side-states.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import type { IssueState } from '@/types/schema/issue-schema'
import {
  stateColor,
  STATE_EMOJI,
  STATE_LABELS,
} from '@dashboard/frontend/common/utils/constants'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { TOKENS } from '@dashboard/frontend/tokens'
import { KanbanCard } from '@dashboard/frontend/kanban/KanbanCard'

interface KanbanColumnProps {
  state: IssueState
}

export function KanbanColumn({ state }: KanbanColumnProps): React.JSX.Element {
  const issues = useIssueStore((s) => s.issues)
  const color = stateColor(state)

  const stateIssues =
    state === 'STUCK'
      ? issues.filter((i) => i.state === 'STUCK' || i.state === 'SPLIT')
      : issues.filter((i) => i.state === state)

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 160,
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        maxHeight: 'calc(100% - 4px)',
      }}
    >
      {/* Column header */}
      <Box
        sx={{
          px: 1,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderTop: 3,
          borderColor: 'divider',
          borderTopColor: color,
          flexShrink: 0,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color,
          }}
        >
          {STATE_EMOJI[state]} {STATE_LABELS[state] ?? state}
        </Typography>
        <Chip
          label={stateIssues.length}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.625rem',
            backgroundColor: TOKENS.surfaceColumnCount,
          }}
        />
      </Box>

      {/* Cards */}
      <Box
        sx={{
          overflow: 'auto',
          p: 0.75,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          flex: 1,
        }}
      >
        {stateIssues.map((issue) => (
          <KanbanCard key={issue.id} issue={issue} />
        ))}
      </Box>
    </Box>
  )
}
