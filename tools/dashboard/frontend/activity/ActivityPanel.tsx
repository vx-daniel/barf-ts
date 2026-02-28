/**
 * Main activity log panel — collapsible bottom panel for the dashboard.
 *
 * Layout when open: three columns —
 *   1. Session list (200 px, left)
 *   2. Log entries (flex, centre)
 *   3. TodoList (collapsible, right)
 *
 * Consecutive `kind: 'stdout'` entries are grouped into {@link StdoutGroup}
 * blocks. Other kinds map to their individual renderers. A terminal input row
 * is shown when `termInputVisible` is true (interactive interview mode).
 *
 * The log pane auto-scrolls to the bottom whenever new entries arrive.
 */
import type React from 'react'
import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Collapse from '@mui/material/Collapse'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TextField from '@mui/material/TextField'
import { useActivityStore } from '@dashboard/frontend/store/useActivityStore'
import { useSessionStore } from '@dashboard/frontend/store/useSessionStore'
import { fmt } from '@dashboard/frontend/common/utils/format'
import { FilterBar } from '@dashboard/frontend/activity/FilterBar'
import { TodoList } from '@dashboard/frontend/activity/TodoList'
import { StdoutGroup } from '@dashboard/frontend/activity/entries/StdoutGroup'
import { StderrRow } from '@dashboard/frontend/activity/entries/StderrRow'
import { ToolCard } from '@dashboard/frontend/activity/entries/ToolCard'
import { TokenRow } from '@dashboard/frontend/activity/entries/TokenRow'
import { ErrorBanner } from '@dashboard/frontend/activity/entries/ErrorBanner'
import { TermLine } from '@dashboard/frontend/activity/entries/TermLine'
import type { ProcessedEntry } from '@dashboard/frontend/store/useActivityStore'
import { TOKENS } from '@dashboard/frontend/tokens'

// ---------------------------------------------------------------------------
// Session list sidebar
// ---------------------------------------------------------------------------

/** Compact session list in the left sidebar of the activity panel. */
function SessionList(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const selectedSessionId = useSessionStore((s) => s.selectedSessionId)
  const selectSession = useSessionStore((s) => s.selectSession)
  const setHistoricalEntries = useActivityStore((s) => s.setHistoricalEntries)
  const restoreLiveEntries = useActivityStore((s) => s.restoreLiveEntries)

  if (sessions.length === 0) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
          No sessions
        </Typography>
      </Box>
    )
  }

  function handleSelect(sessionId: string): void {
    if (selectedSessionId === sessionId) {
      restoreLiveEntries()
      selectSession(sessionId) // toggles off
      return
    }
    selectSession(sessionId)
    // Historical entry loading is handled externally by useSSE in App
    // The store exposes setHistoricalEntries for the hook to call.
    void setHistoricalEntries
  }

  return (
    <Box sx={{ overflowY: 'auto', flex: 1 }}>
      {sessions.map((session) => {
        const isSelected = session.sessionId === selectedSessionId
        const isRunning = session.status === 'running'
        return (
          <Box
            key={session.sessionId}
            component="button"
            onClick={() => handleSelect(session.sessionId)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              width: '100%',
              px: 1,
              py: 0.5,
              bgcolor: isSelected ? TOKENS.selectionBg : 'transparent',
              border: 'none',
              borderLeft: isSelected
                ? `2px solid ${TOKENS.selectionAccent}`
                : '2px solid transparent',
              cursor: 'pointer',
              textAlign: 'left',
              '&:hover': { bgcolor: TOKENS.surfaceHover },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                width: '100%',
              }}
            >
              {isRunning && (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: TOKENS.logDone,
                    flexShrink: 0,
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.3 },
                    },
                  }}
                />
              )}
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: isSelected ? TOKENS.selectionAccent : 'text.secondary',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {session.issueId !== undefined
                  ? `#${session.issueId}`
                  : session.sessionId.slice(0, 8)}
              </Typography>
            </Box>
            {session.mode !== undefined && (
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: 'text.disabled',
                  pl: isRunning ? 1.5 : 0,
                }}
              >
                {session.mode}
              </Typography>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Entry rendering
// ---------------------------------------------------------------------------

/** Module-level agent names map — shared across ToolCard renders. */
const agentNames = new Map<string, string>()

/** Grouped render unit for the log pane. */
type RenderGroup =
  | { type: 'stdout'; entries: ProcessedEntry[] }
  | { type: 'single'; entry: ProcessedEntry }

/**
 * Groups consecutive stdout entries together for {@link StdoutGroup} rendering.
 * All other kinds remain as individual `single` items.
 */
function groupEntries(entries: ProcessedEntry[]): RenderGroup[] {
  const groups: RenderGroup[] = []
  let stdoutBuffer: ProcessedEntry[] = []

  for (const entry of entries) {
    if (entry.kind === 'stdout' && entry.termType === undefined) {
      stdoutBuffer.push(entry)
    } else {
      if (stdoutBuffer.length > 0) {
        groups.push({ type: 'stdout', entries: stdoutBuffer })
        stdoutBuffer = []
      }
      groups.push({ type: 'single', entry })
    }
  }
  if (stdoutBuffer.length > 0) {
    groups.push({ type: 'stdout', entries: stdoutBuffer })
  }
  return groups
}

/** Renders a single non-stdout activity entry. */
function SingleEntry({ entry }: { entry: ProcessedEntry }): React.JSX.Element {
  switch (entry.kind) {
    case 'stderr':
      return <StderrRow entry={entry} />
    case 'tool_call':
      return <ToolCard entry={entry} agentNames={agentNames} />
    case 'token_update':
      return <TokenRow entry={entry} />
    case 'error':
      return <ErrorBanner entry={entry} />
    case 'stdout':
      // termType-bearing stdout entries are synthetic logTerm() lines
      return <TermLine entry={entry} />
    default:
      return (
        <Box
          sx={{
            px: 1,
            py: 0.25,
            fontFamily: 'monospace',
            fontSize: '0.72rem',
            color: 'text.disabled',
          }}
        >
          [{entry.kind}]
        </Box>
      )
  }
}

// ---------------------------------------------------------------------------
// Token counts in header
// ---------------------------------------------------------------------------

/** Computes cumulative in/out token counts from all entries in the log. */
function useTokenTotals(entries: ProcessedEntry[]): {
  totalIn: number
  totalOut: number
} {
  return useMemo(() => {
    let totalIn = 0
    let totalOut = 0
    for (const e of entries) {
      if (e.kind === 'token_update') {
        totalIn +=
          typeof e.data.inputTokens === 'number' ? e.data.inputTokens : 0
        totalOut +=
          typeof e.data.outputTokens === 'number' ? e.data.outputTokens : 0
      }
    }
    return { totalIn, totalOut }
  }, [entries])
}

// ---------------------------------------------------------------------------
// Terminal input row
// ---------------------------------------------------------------------------

interface TermInputRowProps {
  /** Called when the user submits a terminal answer. */
  onSubmit: (text: string) => void
}

/** Input row shown during interactive interview mode. */
function TermInputRow({ onSubmit }: TermInputRowProps): React.JSX.Element {
  const [value, setValue] = useState('')

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        onSubmit(trimmed)
        setValue('')
      }
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        borderTop: `1px solid ${TOKENS.borderSubtle}`,
        bgcolor: TOKENS.surfaceOverlayMedium,
      }}
    >
      <Typography
        sx={{
          fontSize: '0.75rem',
          color: TOKENS.logWarn,
          fontFamily: 'monospace',
          flexShrink: 0,
        }}
      >
        answer &gt;
      </Typography>
      <TextField
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        size="small"
        fullWidth
        placeholder="Type your answer and press Enter"
        autoFocus
        variant="standard"
        InputProps={{
          disableUnderline: true,
          sx: {
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: 'text.primary',
          },
        }}
        sx={{ bgcolor: 'transparent' }}
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface ActivityPanelProps {
  /**
   * Called when the user submits a terminal answer in interview mode.
   * Typically routes to a WebSocket send.
   */
  onTerminalInput?: (text: string) => void
}

/**
 * Main collapsible bottom activity panel.
 *
 * Renders a header bar (always visible), and when open, a three-column layout:
 * session list sidebar, filtered log entries, and optional TodoList sidebar.
 *
 * @param onTerminalInput - Handler called when the user submits a terminal answer
 * @returns The activity panel element
 */
export function ActivityPanel({
  onTerminalInput,
}: ActivityPanelProps): React.JSX.Element {
  const isOpen = useActivityStore((s) => s.isOpen)
  const title = useActivityStore((s) => s.title)
  const entries = useActivityStore((s) => s.entries)
  const filters = useActivityStore((s) => s.filters)
  const termInputVisible = useActivityStore((s) => s.termInputVisible)
  const todoItems = useActivityStore((s) => s.todoItems)
  const openPanel = useActivityStore((s) => s.openPanel)
  const closePanel = useActivityStore((s) => s.closePanel)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const atBottomRef = useRef(true)

  const { totalIn, totalOut } = useTokenTotals(entries)

  // Filter entries by active filter set
  const visibleEntries = useMemo(() => {
    if (filters.size === 0) return entries
    return entries.filter((e) => filters.has(e.kind))
  }, [entries, filters])

  const renderGroups = useMemo(
    () => groupEntries(visibleEntries),
    [visibleEntries],
  )

  // Auto-scroll to bottom when new entries arrive, if already near bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el === null) return
    if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [])

  function handleScroll(): void {
    const el = scrollRef.current
    if (el === null) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottomRef.current = distFromBottom < 60
  }

  function handleToggle(): void {
    if (isOpen) {
      closePanel()
    } else {
      openPanel()
    }
  }

  const handleTerminalInput = useCallback(
    (text: string) => {
      onTerminalInput?.(text)
    },
    [onTerminalInput],
  )

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        borderTop: `1px solid ${TOKENS.borderSubtle}`,
        bgcolor: 'background.paper',
        flexShrink: 0,
      }}
    >
      {/* Header bar */}
      <Box
        component="button"
        onClick={handleToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.5,
          bgcolor: TOKENS.surfaceOverlayDark,
          border: 'none',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          borderBottom: isOpen ? `1px solid ${TOKENS.borderLight}` : 'none',
          '&:hover': { bgcolor: TOKENS.surfaceHover },
        }}
      >
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'text.secondary',
            fontFamily: 'monospace',
            flex: 1,
          }}
        >
          {title}
        </Typography>

        {/* Cumulative token counts */}
        {(totalIn > 0 || totalOut > 0) && (
          <Typography
            sx={{
              fontSize: '0.68rem',
              color: 'text.disabled',
              fontFamily: 'monospace',
            }}
          >
            {fmt(totalIn)} in · {fmt(totalOut)} out
          </Typography>
        )}

        <IconButton
          component="span"
          size="small"
          sx={{ p: 0.25, color: 'text.disabled', pointerEvents: 'none' }}
          aria-label={
            isOpen ? 'Collapse activity panel' : 'Expand activity panel'
          }
        >
          {isOpen ? (
            <ExpandMoreIcon fontSize="small" />
          ) : (
            <ExpandLessIcon fontSize="small" />
          )}
        </IconButton>
      </Box>

      <Collapse in={isOpen}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 280 }}>
          <FilterBar />

          <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Session list sidebar */}
            <Box
              sx={{
                width: 200,
                flexShrink: 0,
                borderRight: `1px solid ${TOKENS.borderFaint}`,
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
              }}
            >
              <Typography
                sx={{
                  px: 1,
                  py: 0.5,
                  fontSize: '0.65rem',
                  color: 'text.disabled',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  borderBottom: `1px solid ${TOKENS.borderLight}`,
                  textTransform: 'uppercase',
                }}
              >
                Sessions
              </Typography>
              <SessionList />
            </Box>

            {/* Log entries pane */}
            <Box
              ref={scrollRef}
              onScroll={handleScroll}
              sx={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                py: 0.5,
              }}
            >
              {renderGroups.length === 0 && (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography
                    sx={{ fontSize: '0.75rem', color: 'text.disabled' }}
                  >
                    No activity yet
                  </Typography>
                </Box>
              )}
              {renderGroups.map((group, idx) => {
                if (group.type === 'stdout') {
                  return (
                    <StdoutGroup
                      key={group.entries[0]?.key ?? idx}
                      entries={group.entries}
                      defaultOpen={idx === renderGroups.length - 1}
                    />
                  )
                }
                return <SingleEntry key={group.entry.key} entry={group.entry} />
              })}
            </Box>

            {/* TodoList sidebar */}
            {todoItems.length > 0 && (
              <Box
                sx={{
                  borderLeft: `1px solid ${TOKENS.borderFaint}`,
                  width: 220,
                  flexShrink: 0,
                  overflowY: 'auto',
                }}
              >
                <TodoList items={todoItems} />
              </Box>
            )}
          </Box>

          {/* Terminal input row */}
          {termInputVisible && <TermInputRow onSubmit={handleTerminalInput} />}
        </Box>
      </Collapse>
    </Box>
  )
}
