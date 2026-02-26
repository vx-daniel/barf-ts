/**
 * Kanban board — reactive Preact component replacing the imperative `renderBoard` function.
 *
 * Reads {@link issues} and {@link runningId} signals directly; Preact's signal
 * integration auto-subscribes each component to only the signals it reads,
 * re-rendering only affected subtrees on change.
 */

import { Fragment } from 'preact'
import { html } from 'htm/preact'
import { openCard, runCommand } from '@dashboard/frontend/lib/actions'
import {
  CMD_ACTIONS,
  CMD_CLASS,
  STATE_LABELS,
  STATE_ORDER,
  stateColor,
} from '@dashboard/frontend/lib/constants'
import { issues, runningId } from '@dashboard/frontend/lib/state'
import type { Issue } from '@dashboard/frontend/lib/types'

function getNewIssueActions(issue: Issue): string[] {
  if (issue.needs_interview === undefined) return ['triage']
  if (issue.needs_interview === true) return ['interview']
  return []
}

function contextBarColor(pct: number): string {
  if (pct > 80) return '#ef4444'
  if (pct > 60) return '#f97316'
  return '#22c55e'
}

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
      : ((CMD_ACTIONS as Record<string, string[]>)[issue.state] ?? [])

  return html`
    <div
      class=${`card${running ? ' running' : ''}`}
      id=${`card-${issue.id}`}
      style=${{ '--sc': color }}
      onClick=${() => openCard(issue)}
    >
      <div class="card-id">#${issue.id}</div>
      <div class="card-title">${issue.title}</div>
      ${
        issue.context_usage_percent != null &&
        html`
        <div class="card-meta">
          <div class="pbar">
            <div
              class="pbar-fill"
              style=${{
                width: `${issue.context_usage_percent}%`,
                background: contextBarColor(issue.context_usage_percent),
              }}
            ></div>
          </div>
          <span class="pbar-lbl">${issue.context_usage_percent}%</span>
        </div>
      `
      }
      ${
        (issue.parent?.trim() ||
          (issue.children && issue.children.length > 0)) &&
        html`
        <div class="card-rel">
          ${issue.parent?.trim() && html`<span class="card-rel-tag">\u2191 ${issue.parent}</span>`}
          ${
            issue.children &&
            issue.children.length > 0 &&
            html`
            <span class="card-rel-tag">\u21d3 ${issue.children.length}</span>
          `
          }
        </div>
      `
      }
      ${
        actions.length > 0 &&
        html`
        <div class="card-actions">
          ${actions.map(
            (cmd) => html`
            <button
              key=${cmd}
              class=${`abtn ${(CMD_CLASS as Record<string, string>)[cmd]}`}
              disabled=${runningId.value !== null}
              onClick=${(e: MouseEvent) => {
                e.stopPropagation()
                runCommand(issue.id, cmd)
              }}
            >${cmd}</button>
          `,
          )}
        </div>
      `
      }
    </div>
  `
}

/**
 * A single state column showing all issues in that state.
 *
 * @param state - The {@link IssueState} string value this column represents
 */
function KanbanColumn({ state }: { state: string }) {
  const labels = STATE_LABELS as Record<string, string>
  const color = stateColor(state)
  const stateIssues = issues.value.filter((i) => i.state === state)

  return html`
    <div class="col">
      <div class="col-hdr" style=${{ color, borderTopColor: color }}>
        <span>${labels[state] ?? state}</span>
        <span class="col-cnt">${stateIssues.length}</span>
      </div>
      <div class="col-body">
        ${stateIssues.map(
          (issue) => html`<${KanbanCard} key=${issue.id} issue=${issue} />`,
        )}
      </div>
    </div>
  `
}

/**
 * Root kanban board component. Renders one {@link KanbanColumn} per state in
 * {@link STATE_ORDER}. Mounted into the `#board` element by `main.ts`.
 */
export function KanbanBoard() {
  return html`
    <${Fragment}>
      ${STATE_ORDER.map((state) => html`<${KanbanColumn} key=${state} state=${state} />`)}
    <//>
  `
}
