/**
 * Todo list panel for the activity log.
 *
 * Displays Claude task progress as a compact checklist extracted from
 * {@link useActivityStore.todoItems} (populated by TaskCreate/TaskUpdate/TodoWrite
 * tool calls). Hidden when no items exist. A progress bar header shows
 * overall completion percentage.
 */
import type React from 'react'
import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import CircularProgress from '@mui/material/CircularProgress'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import type { TodoItem } from '@dashboard/frontend/store/useActivityStore'
import { TOKENS } from '@dashboard/frontend/tokens'

interface TodoListProps {
  /** Task items to display. Component hides itself when empty. */
  items: TodoItem[]
}

interface TodoItemRowProps {
  item: TodoItem
}

/** Renders a single todo item with a status indicator icon. */
function TodoItemRow({ item }: TodoItemRowProps): React.JSX.Element {
  const isCompleted = item.status === 'completed'
  const isInProgress = item.status === 'in_progress'

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.75,
        px: 1,
        py: 0.35,
        opacity: isCompleted ? 0.5 : 1,
      }}
    >
      <Box sx={{ mt: 0.1, flexShrink: 0 }}>
        {isCompleted && (
          <CheckCircleOutlineIcon
            sx={{ fontSize: 14, color: TOKENS.logDone }}
          />
        )}
        {isInProgress && (
          <CircularProgress
            size={12}
            thickness={5}
            sx={{ color: TOKENS.selectionAccent, mt: 0.15 }}
          />
        )}
        {item.status === 'pending' && (
          <RadioButtonUncheckedIcon
            sx={{ fontSize: 14, color: 'text.disabled' }}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: isCompleted ? 'text.disabled' : 'text.primary',
            textDecoration: isCompleted ? 'line-through' : 'none',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {item.subject}
        </Typography>
        {isInProgress && item.activeForm !== undefined && (
          <Typography
            sx={{
              fontSize: '0.68rem',
              color: TOKENS.selectionAccent,
              fontStyle: 'italic',
            }}
          >
            {item.activeForm}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

/**
 * Renders a collapsible checklist of {@link TodoItem} entries with a progress bar header.
 *
 * Hidden entirely when `items` is empty so it takes no space during idle runs.
 *
 * @param items - Array of todo items from {@link useActivityStore}
 * @returns A collapsible todo list element, or an empty fragment when `items` is empty
 */
export function TodoList({ items }: TodoListProps): React.JSX.Element | null {
  const [open, setOpen] = useState(true)

  if (items.length === 0) {
    return null
  }

  const completed = items.filter((t) => t.status === 'completed').length
  const pct = Math.round((completed / items.length) * 100)

  return (
    <Box
      sx={{
        borderLeft: `2px solid ${TOKENS.borderCodeGroup}`,
        bgcolor: TOKENS.surfaceOverlayMedium,
        minWidth: 180,
      }}
    >
      {/* Header */}
      <Box
        component="button"
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          width: '100%',
          px: 1,
          py: 0.5,
          bgcolor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderBottom: `1px solid ${TOKENS.borderFaint}`,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: 'text.secondary',
            flex: 1,
            textAlign: 'left',
          }}
        >
          Tasks {completed}/{items.length}
        </Typography>
        <Typography
          sx={{ fontSize: '0.7rem', color: TOKENS.logDone, fontWeight: 'bold' }}
        >
          {pct}%
        </Typography>
        <IconButton
          component="span"
          size="small"
          sx={{ p: 0.25, color: 'text.disabled', pointerEvents: 'none' }}
          aria-label={open ? 'Collapse tasks' : 'Expand tasks'}
        >
          {open ? (
            <ExpandLessIcon fontSize="inherit" />
          ) : (
            <ExpandMoreIcon fontSize="inherit" />
          )}
        </IconButton>
      </Box>

      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 2,
          bgcolor: TOKENS.borderFaint,
          '& .MuiLinearProgress-bar': { bgcolor: TOKENS.logDone },
        }}
      />

      <Collapse in={open}>
        <Box>
          {items.map((item) => (
            <TodoItemRow key={item.id} item={item} />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
