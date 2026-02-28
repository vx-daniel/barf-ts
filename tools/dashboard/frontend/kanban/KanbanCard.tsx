/**
 * A single issue card within a kanban column.
 */
import type React from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { stateColor } from '@dashboard/frontend/common/utils/constants'
import { ContextBar } from '@dashboard/frontend/common/components/ContextBar'
import { CardActions } from '@dashboard/frontend/kanban/CardActions'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import type { Issue } from '@/types/schema/issue-schema'
import { TOKENS } from '@dashboard/frontend/tokens'

interface KanbanCardProps {
  issue: Issue
}

export function KanbanCard({ issue }: KanbanCardProps): React.JSX.Element {
  const runningId = useIssueStore((s) => s.runningId)
  const openCard = useIssueStore((s) => s.openCard)
  const running = issue.id === runningId
  const color = stateColor(issue.state)

  return (
    <Card
      sx={{
        borderLeft: `3px solid ${color}`,
        cursor: 'pointer',
        opacity: running ? 0.7 : 1,
        transition: 'transform 0.1s',
        '&:hover': { transform: 'translateY(-1px)' },
      }}
      onClick={() => openCard(issue)}
    >
      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            #{issue.id}
          </Typography>
          {(issue.state === 'STUCK' || issue.state === 'SPLIT') && (
            <Chip
              label={issue.state}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.5625rem',
                fontWeight: 700,
                backgroundColor: stateColor(issue.state),
                color: TOKENS.textOnColor,
              }}
            />
          )}
        </Box>

        <Typography
          variant="body2"
          sx={{ mt: 0.25, lineHeight: 1.4, wordBreak: 'break-word' }}
        >
          {issue.title}
        </Typography>

        {issue.context_usage_percent != null && (
          <Box sx={{ mt: 0.5 }}>
            <ContextBar percent={issue.context_usage_percent} showLabel />
          </Box>
        )}

        {(issue.parent?.trim() ||
          (issue.children && issue.children.length > 0)) && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
            {issue.parent?.trim() && (
              <Chip
                label={`\u2191 ${issue.parent}`}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.5625rem' }}
              />
            )}
            {issue.children && issue.children.length > 0 && (
              <Chip
                label={`\u21D3 ${issue.children.length}`}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.5625rem' }}
              />
            )}
          </Box>
        )}

        <CardActions issue={issue} />
      </CardContent>
    </Card>
  )
}
