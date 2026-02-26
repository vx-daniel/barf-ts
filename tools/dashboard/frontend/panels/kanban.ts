/**
 * Kanban board panel — 7-column board extracted from the original playground.
 */

import {
  CMD_ACTIONS,
  CMD_CLASS,
  STATE_LABELS,
  STATE_ORDER,
  stateColor,
} from '@dashboard/frontend/lib/constants'
import { el } from '@dashboard/frontend/lib/dom'
import type { Issue } from '@dashboard/frontend/lib/types'

/**
 * Returns the dynamic action buttons for a NEW issue based on triage state.
 * - `needs_interview === undefined` → triage
 * - `needs_interview === true` → interview
 * - `needs_interview === false` → none (should auto-transition to GROOMED)
 */
function getNewIssueActions(issue: Issue): string[] {
  if (issue.needs_interview === undefined) return ['triage']
  if (issue.needs_interview === true) return ['interview']
  return []
}

/**
 * Callback hooks wired from main.ts into the kanban board so card interactions
 * can trigger editor, command, and running-state updates without the panel
 * importing main-module state directly.
 */
export interface KanbanCallbacks {
  onCardClick: (issue: Issue) => void
  onRunCommand: (issueId: string, cmd: string) => void
  runningId: string | null
}

/**
 * Renders the full kanban board into `container`, replacing any existing
 * content. One column per state in {@link STATE_ORDER}, each populated with
 * issue cards and their available action buttons.
 *
 * @param container - Root element that receives the rendered columns
 * @param issues - Full issue list; filtered per column by state
 * @param cb - Interaction callbacks and running-state reference
 */
export function renderBoard(
  container: HTMLElement,
  issues: Issue[],
  cb: KanbanCallbacks,
): void {
  container.textContent = ''
  for (const state of STATE_ORDER) {
    const stateIssues = issues.filter((i) => i.state === state)
    container.appendChild(buildCol(state, stateIssues, cb))
  }
}

function buildCol(
  state: string,
  stateIssues: Issue[],
  cb: KanbanCallbacks,
): HTMLElement {
  const labels = STATE_LABELS as Record<string, string>
  const color = stateColor(state)
  const col = el('div', 'col')

  const hdr = el('div', 'col-hdr')
  hdr.style.color = color
  hdr.style.borderTopColor = color
  const lbl = el('span')
  lbl.textContent = labels[state] ?? state
  const cnt = el('span', 'col-cnt')
  cnt.textContent = String(stateIssues.length)
  hdr.appendChild(lbl)
  hdr.appendChild(cnt)
  col.appendChild(hdr)

  const body = el('div', 'col-body')
  for (const issue of stateIssues) {
    body.appendChild(buildCard(issue, cb))
  }
  col.appendChild(body)
  return col
}

function buildCard(issue: Issue, cb: KanbanCallbacks): HTMLElement {
  const color = stateColor(issue.state)
  const card = el('div', `card${issue.id === cb.runningId ? ' running' : ''}`)
  card.id = `card-${issue.id}`
  card.style.setProperty('--sc', color)

  const idEl = el('div', 'card-id')
  idEl.textContent = `#${issue.id}`
  card.appendChild(idEl)

  const titleEl = el('div', 'card-title')
  titleEl.textContent = issue.title
  card.appendChild(titleEl)

  if (issue.context_usage_percent != null) {
    const pct = issue.context_usage_percent
    let fillColor: string
    if (pct > 80) {
      fillColor = '#ef4444'
    } else if (pct > 60) {
      fillColor = '#f97316'
    } else {
      fillColor = '#22c55e'
    }
    const meta = el('div', 'card-meta')
    const pbar = el('div', 'pbar')
    const fill = el('div', 'pbar-fill')
    fill.style.width = `${pct}%`
    fill.style.background = fillColor
    pbar.appendChild(fill)
    const lbl2 = el('span', 'pbar-lbl')
    lbl2.textContent = `${pct}%`
    meta.appendChild(pbar)
    meta.appendChild(lbl2)
    card.appendChild(meta)
  }

  // Parent / children badges
  const hasParent = issue.parent?.trim()
  const hasChildren = issue.children && issue.children.length > 0
  if (hasParent || hasChildren) {
    const relRow = el('div', 'card-rel')
    if (hasParent) {
      const pt = el('span', 'card-rel-tag')
      pt.textContent = `\u2191 ${issue.parent}`
      relRow.appendChild(pt)
    }
    if (hasChildren) {
      const ct = el('span', 'card-rel-tag')
      ct.textContent = `\u21d3 ${issue.children.length}`
      relRow.appendChild(ct)
    }
    card.appendChild(relRow)
  }

  const actions =
    issue.state === 'NEW'
      ? getNewIssueActions(issue)
      : ((CMD_ACTIONS as Record<string, string[]>)[issue.state] ?? [])
  if (actions.length > 0) {
    const actDiv = el('div', 'card-actions')
    for (const cmd of actions) {
      const btn = el('button', `abtn ${(CMD_CLASS as Record<string, string>)[cmd]}`) as HTMLButtonElement
      btn.textContent = cmd
      btn.disabled = cb.runningId !== null
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        cb.onRunCommand(issue.id, cmd)
      })
      actDiv.appendChild(btn)
    }
    card.appendChild(actDiv)
  }

  card.addEventListener('click', () => cb.onCardClick(issue))
  return card
}
