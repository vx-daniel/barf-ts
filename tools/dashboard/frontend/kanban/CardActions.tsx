/**
 * Action buttons for a kanban card — runs barf commands (plan/build/audit/triage/interview).
 */
import type React from 'react'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import {
  CMD_COLORS,
  CMD_ACTIONS,
} from '@dashboard/frontend/common/utils/constants'
import { getNewIssueActions } from '@dashboard/frontend/common/utils/issue-helpers'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { useUIStore } from '@dashboard/frontend/store/useUIStore'
import type { Issue } from '@/types/schema/issue-schema'

interface CardActionsProps {
  issue: Issue
}

export function CardActions({
  issue,
}: CardActionsProps): React.JSX.Element | null {
  const runningId = useIssueStore((s) => s.runningId)
  const runCommand = useIssueStore((s) => s.runCommand)
  const interviewTarget = useUIStore((s) => s.interviewTarget)
  const startInterview = useUIStore((s) => s.startInterview)
  const fetchIssues = useIssueStore((s) => s.fetchIssues)

  const actions =
    issue.state === 'NEW'
      ? getNewIssueActions(issue)
      : (CMD_ACTIONS[issue.state] ?? [])

  if (actions.length === 0) return null

  return (
    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
      {actions.map((cmd) => (
        <Button
          key={cmd}
          size="small"
          variant="outlined"
          disabled={
            interviewTarget !== null ||
            (runningId !== null && cmd !== 'interview')
          }
          sx={{
            fontSize: '0.625rem',
            minWidth: 0,
            py: 0,
            px: 0.75,
            borderColor: CMD_COLORS[cmd] ?? 'divider',
            color: CMD_COLORS[cmd] ?? 'text.secondary',
            '&:hover': {
              borderColor: CMD_COLORS[cmd] ?? 'divider',
              backgroundColor: `${CMD_COLORS[cmd] ?? '#fff'}11`,
            },
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (cmd === 'interview') {
              startInterview(issue, () => void fetchIssues())
            } else {
              runCommand(issue.id, cmd)
            }
          }}
        >
          {cmd}
        </Button>
      ))}
    </Box>
  )
}
