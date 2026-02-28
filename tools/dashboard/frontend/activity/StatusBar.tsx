/**
 * Status bar between the header and the kanban board.
 *
 * Renders in two modes:
 * - **Summary** (no issue selected): per-state chip counts plus aggregate
 *   token, run, and duration stats across all issues.
 * - **Selected**: issue id + title + individual stats for the selected issue.
 *
 * When `activeCommand` is set on {@link useIssueStore}, an overlay chip shows
 * the command name with a live-ticking {@link ElapsedTimer}.
 */
import React, { useMemo } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import { ElapsedTimer } from '@dashboard/frontend/common/components/ElapsedTimer'
import { fmt, fmtDuration } from '@dashboard/frontend/common/utils/format'
import {
  STATE_COLORS,
  STATE_LABELS,
  STATE_ORDER,
} from '@dashboard/frontend/lib/constants'
import type { IssueState } from '@/types/schema/issue-schema'
import type { Issue } from '@/types/schema/issue-schema'
import { TOKENS } from '@dashboard/frontend/tokens'

/** Aggregate stats computed from a list of issues. */
interface AggStats {
  totalIn: number
  totalOut: number
  totalRuns: number
  totalDuration: number
}

function aggregateStats(issues: Issue[]): AggStats {
  return issues.reduce<AggStats>(
    (acc, issue) => ({
      totalIn: acc.totalIn + (issue.total_input_tokens ?? 0),
      totalOut: acc.totalOut + (issue.total_output_tokens ?? 0),
      totalRuns: acc.totalRuns + (issue.run_count ?? 0),
      totalDuration: acc.totalDuration + (issue.total_duration_seconds ?? 0),
    }),
    { totalIn: 0, totalOut: 0, totalRuns: 0, totalDuration: 0 },
  )
}

/** Compact stat label+value pair. */
function StatItem({
  label,
  value,
}: {
  label: string
  value: string
}): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
      <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.72rem',
          color: 'text.secondary',
          fontFamily: 'monospace',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

/**
 * Renders the summary mode status bar with per-state counts and aggregate stats.
 *
 * @param issues - All issues from the store
 * @returns A summary bar element
 */
function SummaryBar({ issues }: { issues: Issue[] }): React.JSX.Element {
  const stateCounts = useMemo(() => {
    const counts: Partial<Record<IssueState, number>> = {}
    for (const issue of issues) {
      counts[issue.state] = (counts[issue.state] ?? 0) + 1
    }
    return counts
  }, [issues])

  const stats = useMemo(() => aggregateStats(issues), [issues])

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        flex: 1,
      }}
    >
      {/* State chips */}
      {STATE_ORDER.filter((s) => (stateCounts[s] ?? 0) > 0).map((state) => (
        <Chip
          key={state}
          label={`${STATE_LABELS[state]} ${stateCounts[state] ?? 0}`}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.65rem',
            fontFamily: 'monospace',
            bgcolor: 'transparent',
            border: `1px solid ${STATE_COLORS[state]}`,
            color: STATE_COLORS[state],
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      ))}

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <StatItem label="In" value={fmt(stats.totalIn)} />
        <StatItem label="Out" value={fmt(stats.totalOut)} />
        <StatItem label="Runs" value={String(stats.totalRuns)} />
        <StatItem label="Time" value={fmtDuration(stats.totalDuration)} />
      </Box>
    </Box>
  )
}

/**
 * Renders the selected-issue mode status bar with individual issue stats.
 *
 * @param issue - The currently selected issue
 * @returns A selected-issue bar element
 */
function SelectedBar({ issue }: { issue: Issue }): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
      <Typography
        sx={{
          fontSize: '0.72rem',
          color: 'text.disabled',
          fontFamily: 'monospace',
        }}
      >
        #{issue.id}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.75rem',
          color: 'text.primary',
          maxWidth: 280,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {issue.title}
      </Typography>

      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <StatItem label="In" value={fmt(issue.total_input_tokens ?? 0)} />
        <StatItem label="Out" value={fmt(issue.total_output_tokens ?? 0)} />
        <StatItem label="Runs" value={String(issue.run_count ?? 0)} />
        <StatItem
          label="Time"
          value={fmtDuration(issue.total_duration_seconds ?? 0)}
        />
      </Box>
    </Box>
  )
}

/**
 * Renders the full status bar, switching between summary and selected modes
 * based on the presence of a `selectedId` in {@link useIssueStore}.
 *
 * An active command overlay is shown whenever `activeCommand` is non-null,
 * with a live {@link ElapsedTimer} driven by the command start time.
 *
 * @returns The status bar element
 */
export function StatusBar(): React.JSX.Element {
  const issues = useIssueStore((s) => s.issues)
  const selectedId = useIssueStore((s) => s.selectedId)
  const activeCommand = useIssueStore((s) => s.activeCommand)

  const selectedIssue =
    selectedId !== null ? issues.find((i) => i.id === selectedId) : undefined

  // Track when the active command started so the timer is stable
  const commandStartRef = React.useRef<{ cmd: string; start: number } | null>(
    null,
  )
  if (activeCommand !== null) {
    if (commandStartRef.current?.cmd !== activeCommand) {
      commandStartRef.current = { cmd: activeCommand, start: Date.now() }
    }
  } else {
    commandStartRef.current = null
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        borderBottom: `1px solid ${TOKENS.borderFaint}`,
        bgcolor: TOKENS.surfaceOverlayDark,
        minHeight: 32,
        overflow: 'hidden',
      }}
    >
      {selectedIssue !== undefined ? (
        <SelectedBar issue={selectedIssue} />
      ) : (
        <SummaryBar issues={issues} />
      )}

      {activeCommand !== null && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1,
            py: 0.25,
            border: `1px solid ${TOKENS.selectionAccent}`,
            borderRadius: 1,
            bgcolor: TOKENS.selectionBg,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: TOKENS.selectionAccent,
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
            }}
          />
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: TOKENS.selectionAccent,
              fontFamily: 'monospace',
            }}
          >
            {activeCommand}
          </Typography>
          <ElapsedTimer startTime={commandStartRef.current?.start ?? null} />
        </Box>
      )}
    </Box>
  )
}
