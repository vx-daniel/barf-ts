/**
 * Root kanban board — renders one column per state in STATE_ORDER.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import { STATE_ORDER } from '@dashboard/frontend/common/utils/constants'
import { KanbanColumn } from '@dashboard/frontend/kanban/KanbanColumn'

export function KanbanBoard(): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.75,
        p: 1,
        height: '100%',
        overflow: 'auto',
      }}
    >
      {STATE_ORDER.map((state) => (
        <KanbanColumn key={state} state={state} />
      ))}
    </Box>
  )
}
