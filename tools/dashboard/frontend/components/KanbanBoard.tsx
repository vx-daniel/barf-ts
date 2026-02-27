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
  STATE_EMOJI,
  STATE_LABELS,
  STATE_ORDER,
  stateColor,
} from '@dashboard/frontend/lib/constants'
import { getNewIssueActions } from '@dashboard/frontend/lib/issue-helpers'
import {
  interviewTarget,
  issues,
  runningId,
} from '@dashboard/frontend/lib/state'
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
      className={`card card-border card-xs bg-base-300 border-l-[3px] cursor-pointer transition-[border-color,transform] duration-[0.15s,0.1s] hover:translate-y-[-1px] ${running ? 'opacity-70' : ''}`}
      id={`card-${issue.id}`}
      style={
        { '--sc': color, borderLeftColor: 'var(--sc)' } as Record<
          string,
          string
        >
      }
      role="button"
      tabIndex={0}
      onClick={() => openCard(issue)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') openCard(issue)
      }}
    >
      <div className="card-body p-md pr-[0.5625rem]">
        <div className="flex items-center gap-xs">
          <span className="text-xs text-base-content/50">#{issue.id}</span>
          {(issue.state === 'STUCK' || issue.state === 'SPLIT') && (
            <span
              className="badge badge-xs font-bold border-0"
              style={{
                background: stateColor(issue.state),
                color: 'var(--color-base-100)',
              }}
            >
              {issue.state === 'SPLIT' ? 'SPLIT' : 'STUCK'}
            </span>
          )}
        </div>
        <div className="text-base leading-[1.4] break-words">{issue.title}</div>
        {issue.context_usage_percent != null && (
          <div className="mt-sm flex items-center gap-sm">
            <div className="flex-1 h-[3px] bg-neutral rounded-[0.125rem] overflow-hidden">
              <div
                className="h-full rounded-[0.125rem] transition-[width] duration-300"
                style={{
                  width: `${issue.context_usage_percent}%`,
                  background: contextBarColor(issue.context_usage_percent),
                }}
              />
            </div>
            <span className="text-xs text-base-content/50 whitespace-nowrap">
              {issue.context_usage_percent}%
            </span>
          </div>
        )}
        {(issue.parent?.trim() ||
          (issue.children && issue.children.length > 0)) && (
          <div className="flex gap-[0.3125rem] mt-[0.3125rem] flex-wrap">
            {issue.parent?.trim() && (
              <span className="badge badge-outline badge-xs">
                {'\u2191'} {issue.parent}
              </span>
            )}
            {issue.children && issue.children.length > 0 && (
              <span className="badge badge-outline badge-xs">
                {'\u21d3'} {issue.children.length}
              </span>
            )}
          </div>
        )}
        {actions.length > 0 && (
          <div className="flex gap-xs mt-[0.4375rem] flex-wrap">
            {actions.map((cmd) => (
              <button
                type="button"
                key={cmd}
                className={`btn btn-outline  btn-xs ${CMD_CLASS[cmd as keyof typeof CMD_CLASS] ?? ''}`}
                disabled={
                  interviewTarget.value !== null ||
                  (runningId.value !== null && cmd !== 'interview')
                }
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
  // STUCK column absorbs SPLIT issues — both are "blocked" side-states
  const stateIssues =
    state === 'STUCK'
      ? issues.value.filter((i) => i.state === 'STUCK' || i.state === 'SPLIT')
      : issues.value.filter((i) => i.state === state)

  return (
    <div className="flex flex-col flex-1 min-w-[10rem] bg-base-200 border border-neutral rounded-default overflow-hidden max-h-[calc(100%-4px)]">
      <div
        className="px-lg py-md text-sm font-bold tracking-[0.08em] uppercase border-b border-neutral flex items-center justify-between shrink-0 border-t-[3px]"
        style={{ color, borderTopColor: color }}
      >
        <span>
          {STATE_EMOJI[state]} {STATE_LABELS[state] ?? state}
        </span>
        <span className="badge badge-sm bg-base-300 border-0 text-base-content/50">
          {stateIssues.length}
        </span>
      </div>
      <div className="overflow-y-auto p-md flex flex-col gap-sm flex-1">
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
