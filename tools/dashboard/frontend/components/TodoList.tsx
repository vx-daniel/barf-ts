/**
 * Compact, collapsible todo progress bar extracted from Claude's
 * TaskCreate/TaskUpdate tool calls during a barf command run.
 *
 * Renders as a sticky bar between the filter row and the scrollable log
 * inside {@link ActivityLog}. Hidden when no tasks exist.
 */

import { todoItems } from '@dashboard/frontend/lib/state'
import type { TodoItem } from '@dashboard/frontend/lib/types'
import { useState } from 'preact/hooks'

// ── Status icons ──────────────────────────────────────────────────────────

const STATUS_ICON: Record<TodoItem['status'], string> = {
  completed: '✓',
  in_progress: '⟳',
  pending: '○',
}

const STATUS_COLOR: Record<TodoItem['status'], string> = {
  completed: 'text-success',
  in_progress: 'text-warning',
  pending: 'text-text-muted',
}

// ── Component ─────────────────────────────────────────────────────────────

export function TodoList() {
  const items = todoItems.value
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  const completed = items.filter((t) => t.status === 'completed').length
  const total = items.length
  const pct = total > 0 ? (completed / total) * 100 : 0
  const active = items.find((t) => t.status === 'in_progress')

  return (
    <div className="border-b border-neutral shrink-0">
      {/* Collapsed header — always visible */}
      <button
        type="button"
        className="flex items-center gap-md px-lg py-xs w-full bg-transparent text-inherit cursor-pointer select-none hover:bg-base-200 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs text-text-muted">{expanded ? '▼' : '▶'}</span>
        <span className="text-xs text-text-muted font-medium">Tasks:</span>

        {/* Progress bar */}
        <div className="flex-1 max-w-[12rem] h-[0.375rem] bg-base-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <span className="text-xs text-text-muted tabular-nums">
          {completed}/{total}
        </span>

        {/* Active task label */}
        {active && (
          <span className="text-xs text-warning truncate max-w-[14rem]">
            ⟳ {active.activeForm ?? active.subject}
          </span>
        )}
      </button>

      {/* Expanded checklist */}
      {expanded && (
        <div className="px-lg pb-xs">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-sm py-[0.125rem] text-xs"
            >
              <span className={STATUS_COLOR[item.status]}>
                {STATUS_ICON[item.status]}
              </span>
              <span
                className={
                  item.status === 'completed'
                    ? 'text-text-muted line-through'
                    : 'text-text'
                }
              >
                {item.subject}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
