/**
 * Header strip rendered at the top of the sidebar.
 *
 * Displays the selected issue's numeric ID, title, current state badge,
 * parent/child relationship chips, and tab switcher between the Issue and
 * Prompts panels. A close button dismisses the sidebar.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import CloseIcon from '@mui/icons-material/Close'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { useUIStore } from '@dashboard/frontend/store/useUIStore'
import { StateBadge } from '@dashboard/frontend/common/components/StateBadge'
import { RelChip } from '@dashboard/frontend/common/components/RelChip'
import type { SxProps, Theme } from '@mui/material/styles'

interface SidebarHeaderProps {
  /** Called when the user clicks the close button. */
  onClose: () => void
}

/**
 * Sidebar header with issue identity, state badge, relationship chips, and panel tabs.
 *
 * @param onClose - Callback fired when the user dismisses the sidebar.
 * @returns The rendered header strip.
 */
export function SidebarHeader({
  onClose,
}: SidebarHeaderProps): React.JSX.Element {
  const selectedId = useIssueStore((s) => s.selectedId)
  const issues = useIssueStore((s) => s.issues)
  const sidebarTab = useUIStore((s) => s.sidebarTab)
  const setSidebarTab = useUIStore((s) => s.setSidebarTab)

  const issue = issues.find((i) => i.id === selectedId) ?? null

  const chipRowSx: SxProps<Theme> = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 0.5,
    px: 1.5,
    pb: 0.75,
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
      {/* Title row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          px: 1.5,
          pt: 1,
          pb: 0.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 600, flexShrink: 0 }}
            >
              #{issue?.id ?? selectedId}
            </Typography>
            {issue !== null && <StateBadge state={issue.state} />}
          </Box>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              lineHeight: 1.3,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {issue?.title ?? 'Loading…'}
          </Typography>
        </Box>

        <IconButton
          size="small"
          onClick={onClose}
          sx={{ flexShrink: 0, mt: -0.25 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Relationship chips */}
      {issue !== null && (issue.parent !== '' || issue.children.length > 0) && (
        <Box sx={chipRowSx}>
          {issue.parent !== '' && (
            <RelChip
              issueId={issue.parent}
              label={`#${issue.parent}`}
              variant="parent"
            />
          )}
          {issue.children.map((childId) => (
            <RelChip
              key={childId}
              issueId={childId}
              label={`#${childId}`}
              variant="child"
            />
          ))}
        </Box>
      )}

      <Divider />

      {/* Panel tab switcher */}
      <Tabs
        value={sidebarTab}
        onChange={(_e, v: string) => setSidebarTab(v as 'issue' | 'prompts')}
        sx={{ px: 1 }}
      >
        <Tab label="Issue" value="issue" />
        <Tab label="Prompts" value="prompts" />
      </Tabs>
    </Box>
  )
}
