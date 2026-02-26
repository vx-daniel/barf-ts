/**
 * Dashboard main entry — mounts Preact components, wires DOM events,
 * and kicks off the initial data fetch.
 *
 * State lives in {@link module:lib/state}; business logic in
 * {@link module:lib/actions}. This file is intentionally thin.
 */

import { KanbanBoard } from '@dashboard/frontend/components/KanbanBoard'
import { StatusBar } from '@dashboard/frontend/components/StatusBar'
import {
  deleteIssue,
  doTransition,
  fetchConfig,
  fetchIssues,
  navigateToIssue,
  onActivityClose,
  runAuto,
  runCommand,
  stopAndReset,
  submitNewIssue,
  wsClient,
} from '@dashboard/frontend/lib/actions'
import { getEl } from '@dashboard/frontend/lib/dom'
import {
  mountBottomResizer,
  mountSidebarResizer,
} from '@dashboard/frontend/lib/resizer'
import {
  issues,
  pauseRefresh,
  runningId,
  selectedId,
} from '@dashboard/frontend/lib/state'
import {
  mountActivityLog,
  termLog,
} from '@dashboard/frontend/panels/activity-log'
import { initConfigPanel } from '@dashboard/frontend/panels/config'
import { closeSidebar, initEditor } from '@dashboard/frontend/panels/editor'
import { render } from 'preact'

// ── Mount Preact components ───────────────────────────────────────────────────
// Signals read inside components auto-subscribe them — no manual effects needed.

render(<KanbanBoard />, getEl('board'))
render(<StatusBar />, getEl('statusbar'))

// ── Mount imperative panels ───────────────────────────────────────────────────
// Activity log, editor, and config remain imperative — they manage complex
// streaming state and CodeMirror that are better handled outside Preact.

mountActivityLog(getEl('bottom'))
mountSidebarResizer()
mountBottomResizer()
initConfigPanel()

// ── Init editor ───────────────────────────────────────────────────────────────

initEditor({
  onTransition: doTransition,
  onDelete: deleteIssue,
  onRunCommand: runCommand,
  onStop: stopAndReset,
  onNavigate: navigateToIssue,
  onClose: () => {
    selectedId.value = null
  },
  getIssues: () => issues.value,
  get runningId() {
    return runningId.value
  },
})

// ── DOM event wiring ──────────────────────────────────────────────────────────

document
  .getElementById('activity-close')
  ?.addEventListener('click', onActivityClose)

document.getElementById('term-input')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  const input = e.target as HTMLInputElement
  const val = input.value
  input.value = ''
  termLog('info', `> ${val}`)
  wsClient.send(val)
})

document.getElementById('btn-auto')?.addEventListener('click', runAuto)

// ── New Issue Modal ───────────────────────────────────────────────────────────

document.getElementById('btn-new')?.addEventListener('click', () => {
  ;(document.getElementById('modal-ttl') as HTMLInputElement).value = ''
  ;(document.getElementById('modal-bdy') as HTMLTextAreaElement).value = ''
  document.getElementById('modal-ov')?.classList.add('open')
  setTimeout(
    () => (document.getElementById('modal-ttl') as HTMLInputElement).focus(),
    50,
  )
})

document.getElementById('modal-ov')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget)
    document.getElementById('modal-ov')?.classList.remove('open')
})

document.getElementById('modal-cancel')?.addEventListener('click', () => {
  document.getElementById('modal-ov')?.classList.remove('open')
})

document.getElementById('modal-ttl')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void submitNewIssue()
})

document
  .getElementById('modal-submit')
  ?.addEventListener('click', () => void submitNewIssue())

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('config-ov')?.classList.contains('open')) {
      document.getElementById('config-ov')?.classList.remove('open')
      return
    }
    if (document.getElementById('modal-ov')?.classList.contains('open')) {
      document.getElementById('modal-ov')?.classList.remove('open')
      return
    }
    if (!document.getElementById('app')?.classList.contains('no-sidebar')) {
      closeSidebar()
      selectedId.value = null
      return
    }
  }
  if (
    e.key === 'n' &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    document.activeElement === document.body
  ) {
    document.getElementById('btn-new')?.click()
  }
})

// ── Polling ───────────────────────────────────────────────────────────────────

let refreshInterval: ReturnType<typeof setInterval> | null = null

function scheduleRefresh(): void {
  if (refreshInterval !== null) clearInterval(refreshInterval)
  refreshInterval = setInterval(() => {
    if (!pauseRefresh.value) void fetchIssues()
  }, 5000)
}

// ── Start ─────────────────────────────────────────────────────────────────────

void fetchConfig()
void fetchIssues()
scheduleRefresh()
