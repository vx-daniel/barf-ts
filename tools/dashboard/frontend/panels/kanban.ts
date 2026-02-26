/**
 * Kanban board panel — 7-column board extracted from the original playground.
 */
import type { Issue } from '../lib/types'

const STATE_ORDER = ['NEW', 'GROOMED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'STUCK', 'SPLIT'] as const

const STATE_COLORS: Record<string, string> = {
  NEW: '#6b7280',
  GROOMED: '#3b82f6',
  PLANNED: '#f59e0b',
  IN_PROGRESS: '#f97316',
  COMPLETED: '#22c55e',
  VERIFIED: '#10b981',
  STUCK: '#ef4444',
  SPLIT: '#a855f7',
}

const STATE_LABELS: Record<string, string> = {
  NEW: 'NEW',
  GROOMED: 'GROOMED',
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN PROGRESS',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  STUCK: 'STUCK',
  SPLIT: 'SPLIT',
}

const CMD_ACTIONS: Record<string, string[]> = {
  NEW: [],
  GROOMED: ['plan'],
  PLANNED: ['plan', 'build'],
  IN_PROGRESS: ['build'],
  COMPLETED: ['audit'],
  VERIFIED: [],
  STUCK: ['plan'],
  SPLIT: [],
}

const CMD_CLASS: Record<string, string> = {
  plan: 'abtn-plan',
  build: 'abtn-build',
  audit: 'abtn-audit',
  triage: 'abtn-triage',
  interview: 'abtn-interview',
}

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

export { STATE_COLORS, STATE_LABELS, CMD_ACTIONS }

function el(tag: string, cls?: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  return e
}

export interface KanbanCallbacks {
  onCardClick: (issue: Issue) => void
  onRunCommand: (issueId: string, cmd: string) => void
  runningId: string | null
}

export function renderBoard(container: HTMLElement, issues: Issue[], cb: KanbanCallbacks): void {
  container.textContent = ''
  for (const state of STATE_ORDER) {
    const stateIssues = issues.filter((i) => i.state === state)
    container.appendChild(buildCol(state, stateIssues, cb))
  }
}

function buildCol(state: string, stateIssues: Issue[], cb: KanbanCallbacks): HTMLElement {
  const color = STATE_COLORS[state]
  const col = el('div', 'col')

  const hdr = el('div', 'col-hdr')
  hdr.style.color = color
  hdr.style.borderTopColor = color
  const lbl = el('span')
  lbl.textContent = STATE_LABELS[state] ?? state
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
  const color = STATE_COLORS[issue.state]
  const card = el('div', 'card' + (issue.id === cb.runningId ? ' running' : ''))
  card.id = 'card-' + issue.id
  card.style.setProperty('--sc', color)

  const idEl = el('div', 'card-id')
  idEl.textContent = '#' + issue.id
  card.appendChild(idEl)

  const titleEl = el('div', 'card-title')
  titleEl.textContent = issue.title
  card.appendChild(titleEl)

  if (issue.context_usage_percent != null) {
    const pct = issue.context_usage_percent
    const fillColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f97316' : '#22c55e'
    const meta = el('div', 'card-meta')
    const pbar = el('div', 'pbar')
    const fill = el('div', 'pbar-fill')
    fill.style.width = pct + '%'
    fill.style.background = fillColor
    pbar.appendChild(fill)
    const lbl2 = el('span', 'pbar-lbl')
    lbl2.textContent = pct + '%'
    meta.appendChild(pbar)
    meta.appendChild(lbl2)
    card.appendChild(meta)
  }

  // Parent / children badges
  const hasParent = issue.parent && issue.parent.trim()
  const hasChildren = issue.children && issue.children.length > 0
  if (hasParent || hasChildren) {
    const relRow = el('div', 'card-rel')
    if (hasParent) {
      const pt = el('span', 'card-rel-tag')
      pt.textContent = '\u2191 ' + issue.parent
      relRow.appendChild(pt)
    }
    if (hasChildren) {
      const ct = el('span', 'card-rel-tag')
      ct.textContent = '\u21d3 ' + issue.children.length
      relRow.appendChild(ct)
    }
    card.appendChild(relRow)
  }

  const actions = issue.state === 'NEW' ? getNewIssueActions(issue) : (CMD_ACTIONS[issue.state] ?? [])
  if (actions.length > 0) {
    const actDiv = el('div', 'card-actions')
    for (const cmd of actions) {
      const btn = el('button', 'abtn ' + CMD_CLASS[cmd]) as HTMLButtonElement
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
