/**
 * Top-level dashboard header bar with project path, auto-run toggle, and action buttons.
 * Uses MUI AppBar for consistent styling.
 */
import type React from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { useConfigStore } from '@dashboard/frontend/store/useConfigStore'
import { useUIStore } from '@dashboard/frontend/store/useUIStore'
import { useSessionStore } from '@dashboard/frontend/store/useSessionStore'

/** Labels for each audit gate state. */
const GATE_LABELS: Record<string, string | null> = {
  running: null,
  draining: 'Draining...',
  auditing: 'Auditing...',
  fixing: 'Fixing...',
}

export function Header(): React.JSX.Element {
  const runningId = useIssueStore((s) => s.runningId)
  const runAuto = useIssueStore((s) => s.runAuto)
  const models = useConfigStore((s) => s.models)
  const auditGate = useConfigStore((s) => s.auditGate)
  const triggerAuditGate = useConfigStore((s) => s.triggerAuditGate)
  const cancelAuditGate = useConfigStore((s) => s.cancelAuditGate)
  const openNewIssue = useUIStore((s) => s.openNewIssue)
  const openConfig = useUIStore((s) => s.openConfig)
  const toggleProfiling = useUIStore((s) => s.toggleProfiling)
  const profiling = useUIStore((s) => s.profiling)
  const stopAll = useSessionStore((s) => s.stopAll)

  const isRunning = runningId !== null
  const gateActive = auditGate.state !== 'running'
  const gateLabel = GATE_LABELS[auditGate.state]

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar variant="dense" sx={{ gap: 1.5, minHeight: 44 }}>
        <Typography
          variant="h6"
          sx={{ color: 'primary.main', whiteSpace: 'nowrap' }}
        >
          {'\u25C8'} barf dashboard
        </Typography>
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            color: 'text.secondary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {models?.projectCwd ?? ''}
        </Typography>

        {gateLabel && (
          <Chip
            label={`\u{1F6E1} ${gateLabel}`}
            color="warning"
            size="small"
            sx={{ animation: 'pulse 2s infinite' }}
          />
        )}

        <Button
          variant="outlined"
          size="small"
          color={gateActive ? 'warning' : 'primary'}
          onClick={() =>
            void (gateActive ? cancelAuditGate() : triggerAuditGate())
          }
        >
          {gateActive ? 'Cancel Audit' : '\u{1F50D} Audit'}
        </Button>

        <Button
          variant="outlined"
          color={isRunning ? 'secondary' : 'primary'}
          onClick={runAuto}
        >
          {isRunning ? '\u{1F6D1} Stop' : '\u{1F680} Auto'}
        </Button>

        <Button variant="outlined" color="error" onClick={() => void stopAll()}>
          {'\u{1F6D1} Stop All'}
        </Button>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button variant="text" onClick={openNewIssue}>
            + New Issue
          </Button>
          <Button
            variant="text"
            onClick={toggleProfiling}
            sx={profiling ? { color: 'warning.main' } : {}}
          >
            {profiling ? '\u{1F534} Profiling' : '\u23F1 Profile'}
          </Button>
          <Button variant="text" onClick={openConfig}>
            {'\u2699'} Config
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
