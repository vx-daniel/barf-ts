/**
 * Persistent right-side drawer that hosts the issue detail panel and prompts panel.
 *
 * Visibility is driven by `useIssueStore` — the drawer mounts when an issue is
 * selected and unmounts when `selectedId` becomes null. Width is drag-resizable
 * via {@link useResizable} with a handle on the left edge.
 */
import type React from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { useUIStore } from '@dashboard/frontend/store/useUIStore'
import { useResizable } from '@dashboard/frontend/common/hooks/useResizable'
import { SidebarHeader } from '@dashboard/frontend/sidebar/SidebarHeader'
import { IssuePanel } from '@dashboard/frontend/sidebar/issues/IssuePanel'
import { PromptPanel } from '@dashboard/frontend/sidebar/prompts/PromptPanel'

/**
 * Root sidebar shell.
 *
 * @returns A persistent MUI Drawer anchored to the right, or null when no issue is selected.
 */
export function Sidebar(): React.JSX.Element | null {
  const selectedId = useIssueStore((s) => s.selectedId)
  const setSelectedId = useIssueStore((s) => s.setSelectedId)
  const sidebarTab = useUIStore((s) => s.sidebarTab)

  const { size: width, handleRef } = useResizable({
    direction: 'horizontal',
    initial: 400,
    min: 280,
    max: 800,
  })

  if (selectedId === null) return null

  return (
    <Drawer
      variant="persistent"
      anchor="right"
      open={true}
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          position: 'relative',
          height: '100%',
          overflow: 'hidden',
        },
      }}
    >
      {/* Resize handle — left edge drag target */}
      <Box
        ref={handleRef}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
          '&:hover': { backgroundColor: 'primary.main', opacity: 0.5 },
        }}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <SidebarHeader onClose={() => setSelectedId(null)} />

        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {sidebarTab === 'issue' && <IssuePanel />}
          {sidebarTab === 'prompts' && <PromptPanel />}
        </Box>
      </Box>
    </Drawer>
  )
}
