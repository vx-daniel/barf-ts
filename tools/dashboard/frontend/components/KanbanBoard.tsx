/**
 * Kanban board — reactive Preact component replacing the imperative `renderBoard` function.
 *
 * Reads {@link issues} and {@link runningId} signals directly; Preact's signal
 * integration auto-subscribes each component to only the signals it reads,
 * re-rendering only affected subtrees on change.
 */

import { openCard, runCommand } from '@dashboard/frontend/lib/actions'
import {
  CMD_ACTIONS,
  CMD_CLASS,
  contextBarColor,
  STATE_LABELS,
  STATE_ORDER,
  stateColor,
} from '@dashboard/frontend/lib/constants'
import { getNewIssueActions } from '@dashboard/frontend/lib/issue-helpers'
import { issues, runningId } from '@dashboard/frontend/lib/state'
import type { Issue } from '@dashboard/frontend/lib/types'
import type { IssueState } from '@/types/schema/issue-schema'

/**
 * A single issue card within a kanban column.
 *
 * @param issue - The issue to display; provides id, title, state, and optional metadata
 */
function KanbanCard({ issue }: { issue: Issue }) {
  const running = issue.id === runningId.value
  const color = stateColor(issue.state)
  const actions =
    issue.state === 'NEW'
      ? getNewIssueActions(issue)
      : (CMD_ACTIONS[issue.state] ?? [])

  return (
    // biome-ignore lint/a11y/useSemanticElements: card is a complex container, not a simple button
    <div
      className={`card${running ? ' running' : ''}`}
      id={`card-${issue.id}`}
      style={{ '--sc': color } as Record<string, string>}
      role="button"
      tabIndex={0}
      onClick={() => openCard(issue)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') openCard(issue)
      }}
    >
      <div className="card-id">#{issue.id}</div>
      <div className="card-title">{issue.title}</div>
      {issue.context_usage_percent != null && (
        <div className="card-meta">
          <div className="pbar">
            <div
              className="pbar-fill"
              style={{
                width: `${issue.context_usage_percent}%`,
                background: contextBarColor(issue.context_usage_percent),
              }}
            ></div>
          </div>
          <span className="pbar-lbl">{issue.context_usage_percent}%</span>
        </div>
      )}
      {(issue.parent?.trim() ||
        (issue.children && issue.children.length > 0)) && (
        <div className="card-rel">
          {issue.parent?.trim() && (
            <span className="card-rel-tag">
              {'\u2191'} {issue.parent}
            </span>
          )}
          {issue.children && issue.children.length > 0 && (
            <span className="card-rel-tag">
              {'\u21d3'} {issue.children.length}
            </span>
          )}
        </div>
      )}
      {actions.length > 0 && (
        <div className="card-actions">
          {actions.map((cmd) => (
            <button
              type="button"
              key={cmd}
              className={`abtn ${CMD_CLASS[cmd as keyof typeof CMD_CLASS] ?? ''}`}
              disabled={runningId.value !== null}
              onClick={(e: MouseEvent) => {
                e.stopPropagation()
                runCommand(issue.id, cmd)
              }}
            >
              {cmd}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A single state column showing all issues in that state.
 *
 * @param state - The {@link IssueState} string value this column represents
 */
function KanbanColumn({ state }: { state: IssueState }) {
  const color = stateColor(state)
  const stateIssues = issues.value.filter((i) => i.state === state)

  return (
    <div className="col">
      <div className="col-hdr" style={{ color, borderTopColor: color }}>
        <span>{STATE_LABELS[state] ?? state}</span>
        <span className="col-cnt">{stateIssues.length}</span>
      </div>
      <div className="col-body">
        {stateIssues.map((issue) => (
          <KanbanCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  )
}

/**
 * Root kanban board component. Renders one {@link KanbanColumn} per state in
 * {@link STATE_ORDER}. Mounted into the `#board` element by `main.tsx`.
 */
export function KanbanBoard() {
  return (
    <>
      {STATE_ORDER.map((state) => (
        <KanbanColumn key={state} state={state} />
      ))}
    </>
  )
}
