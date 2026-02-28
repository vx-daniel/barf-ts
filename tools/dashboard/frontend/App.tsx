/**
 * Root application shell — grid layout with header, statusbar, kanban, sidebar, activity panel, and modals.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import { Header } from '@dashboard/frontend/header/Header'
import { StatusBar } from '@dashboard/frontend/activity/StatusBar'
import { KanbanBoard } from '@dashboard/frontend/kanban/KanbanBoard'
import { Sidebar } from '@dashboard/frontend/sidebar/Sidebar'
import { ActivityPanel } from '@dashboard/frontend/activity/ActivityPanel'
import { NewIssueModal } from '@dashboard/frontend/modals/NewIssueModal'
import { InterviewModal } from '@dashboard/frontend/modals/InterviewModal'
import { ConfigPanel } from '@dashboard/frontend/modals/ConfigPanel'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { useUIStore } from '@dashboard/frontend/store/useUIStore'
import { useKeyboardShortcut } from '@dashboard/frontend/common/hooks/useKeyboardShortcut'

/**
 * Top-level layout with keyboard shortcuts and all panels + modals.
 */
export function App(): React.JSX.Element {
  const selectedId = useIssueStore((s) => s.selectedId)
  const setSelectedId = useIssueStore((s) => s.setSelectedId)
  const sidebarOpen = selectedId !== null

  // Global keyboard shortcuts
  useKeyboardShortcut({
    key: 'Escape',
    handler: () => {
      // Close sidebar, or close modals
      if (selectedId) setSelectedId(null)
    },
  })

  useKeyboardShortcut({
    key: 'n',
    handler: () => useUIStore.getState().openNewIssue(),
  })

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        gridTemplateColumns: '1fr',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Header />
      <StatusBar />
      <Box sx={{ gridRow: 3, overflow: 'hidden', display: 'flex' }}>
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <KanbanBoard />
        </Box>
        {sidebarOpen && <Sidebar />}
      </Box>
      <ActivityPanel />

      {/* Modals */}
      <NewIssueModal />
      <InterviewModal />
      <ConfigPanel />
    </Box>
  )
}
