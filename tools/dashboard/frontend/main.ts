/**
 * Dashboard main entry — initializes panels, SSE/WS connections, and polling.
 */
import type { Issue } from './lib/types'
import * as api from './lib/api-client'
import { SSEClient } from './lib/sse-client'
import { WSClient } from './lib/ws-client'
import { renderBoard } from './panels/kanban'
import { mountStatus, updateStatus, updateSummary, setActiveCommand } from './panels/status'
import {
  mountActivityLog,
  appendActivity,
  termLog,
  clearLog,
  setTermInput,
  openActivityPanel,
  closeActivityPanel,
} from './panels/activity-log'
import { initEditor, openIssue, closeSidebar, getCurrentIssueId } from './panels/editor'
import { initConfigPanel } from './panels/config'
import { openInterview } from './panels/interview-modal'
import { mountSidebarResizer, mountBottomResizer } from './lib/resizer'

// ── State ────────────────────────────────────────────────────────────────────
let issues: Issue[] = []
let selectedId: string | null = null
let runningId: string | null = null
let pauseRefresh = false
let models: Record<string, string> | null = null

const sseClient = new SSEClient()
const wsClient = new WSClient()

// ── Boot ─────────────────────────────────────────────────────────────────────

// Mount panels
mountStatus(document.getElementById('statusbar')!)
mountActivityLog(document.getElementById('bottom')!)
mountSidebarResizer()
mountBottomResizer()
initConfigPanel()

// Init editor callbacks
initEditor({
  onTransition: doTransition,
  onDelete: deleteIssue,
  onRunCommand: runCommand,
  onStop: stopAndReset,
  onNavigate: navigateToIssue,
  onClose: () => {
    selectedId = null
    updateStatus(null, models ?? undefined)
  },
  getIssues: () => issues,
  get runningId() { return runningId },
})

// Activity panel close button
document.getElementById('activity-close')?.addEventListener('click', () => {
  closeActivityPanel()
  stopActive()
  runningId = null
  pauseRefresh = false
  refreshBoard()
})

// Interview input
document.getElementById('term-input')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return
  const input = e.target as HTMLInputElement
  const val = input.value
  input.value = ''
  termLog('info', '> ' + val)
  wsClient.send(val)
})

// Load config + set project path
api.fetchConfig().then((c) => {
  models = c
  const pathEl = document.getElementById('project-path')
  if (pathEl && c.projectCwd) pathEl.textContent = c.projectCwd
}).catch(() => {})

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchIssues(): Promise<void> {
  try {
    issues = await api.fetchIssues()
    refreshBoard()
    updateSummary(issues)
    if (selectedId) {
      const updated = issues.find((i) => i.id === selectedId)
      if (updated) {
        updateStatus(updated, models ?? undefined)
      }
    }
  } catch (e) {
    console.error('fetch issues:', e)
  }
}

function refreshBoard(): void {
  renderBoard(document.getElementById('board')!, issues, {
    onCardClick: openCard,
    onRunCommand: runCommand,
    runningId,
  })
}

function scheduleRefresh(): void {
  setInterval(() => {
    if (!pauseRefresh) fetchIssues()
  }, 5000)
}

// ── Issue operations ─────────────────────────────────────────────────────────

function openCard(issue: Issue): void {
  selectedId = issue.id
  openIssue(issue)
  updateStatus(issue, models ?? undefined)
}

function navigateToIssue(id: string): void {
  const issue = issues.find((i) => i.id === id)
  if (issue) openCard(issue)
}

async function doTransition(id: string, to: string): Promise<void> {
  try {
    await api.transitionIssue(id, to)
    await fetchIssues()
  } catch (e) {
    termLog('error', 'Transition failed: ' + (e instanceof Error ? e.message : String(e)))
  }
}

async function deleteIssue(id: string): Promise<void> {
  try {
    await api.deleteIssue(id)
    closeSidebar()
    selectedId = null
    await fetchIssues()
  } catch (e) {
    termLog('error', 'Delete failed: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

function refreshSidebar(): void {
  if (selectedId) {
    const issue = issues.find((i) => i.id === selectedId)
    if (issue) openIssue(issue)
  }
}

function stopAndReset(): void {
  api.stopActive()
  stopActive()
  termLog('info', 'Stopped.')
  runningId = null
  pauseRefresh = false
  setActiveCommand(null)
  refreshSidebar()
  fetchIssues()
}

function stopActive(): void {
  sseClient.close()
  wsClient.close()
  setTermInput(false)
  setActiveCommand(null)
}

function onCommandDone(exitCode: number): void {
  const ok = exitCode === 0
  termLog(ok ? 'done' : 'error', ok ? 'Done (exit 0)' : 'Failed (exit ' + exitCode + ')')
  runningId = null
  pauseRefresh = false
  setTermInput(false)
  setActiveCommand(null)
  setAutoBtn('auto')
  refreshSidebar()
  fetchIssues()
}

function applyLiveStats(stats: { totalInputTokens: number; totalOutputTokens: number; contextSize: number }): void {
  if (!runningId) return
  const issue = issues.find((i) => i.id === runningId)
  if (issue) {
    issue.total_input_tokens = stats.totalInputTokens
    issue.total_output_tokens = stats.totalOutputTokens
  }
  updateSummary(issues)
  if (selectedId === runningId && issue) {
    updateStatus(issue, models ?? undefined)
  }
}

function handleMsg(data: Record<string, unknown>): void {
  if (data.type === 'stdout') {
    const line = data.line as string
    if (line?.startsWith('__BARF_STATS__:')) {
      try {
        const stats = JSON.parse(line.slice('__BARF_STATS__:'.length))
        applyLiveStats(stats)
      } catch { /* malformed — ignore */ }
      return
    }
    if (line?.trim()) {
      termLog('stdout', line)
      appendActivity({
        timestamp: Date.now(),
        source: 'command',
        kind: 'stdout',
        data: { line },
      })
    }
  } else if (data.type === 'stderr' && (data.line as string)?.trim()) {
    termLog('stderr', data.line as string)
    appendActivity({
      timestamp: Date.now(),
      source: 'command',
      kind: 'stderr',
      data: { line: data.line },
    })
  } else if (data.type === 'done') {
    onCommandDone(data.exitCode as number)
  } else if (data.type === 'error') {
    termLog('error', 'Error: ' + data.message)
    runningId = null
    pauseRefresh = false
    setTermInput(false)
    setActiveCommand(null)
  }
}

function runCommand(id: string, cmd: string): void {
  // Interview opens a modal instead of spawning a subprocess
  if (cmd === 'interview') {
    const issue = issues.find((i) => i.id === id)
    if (!issue) return
    openInterview(issue, () => {
      fetchIssues()
      if (selectedId === id) {
        const updated = issues.find((i) => i.id === id)
        if (updated) openIssue(updated)
      }
    })
    return
  }

  stopActive()
  pauseRefresh = true
  runningId = id
  refreshBoard()
  refreshSidebar()
  openActivityPanel('barf ' + cmd + ' --issue ' + id)
  clearLog()
  termLog('info', 'Starting barf ' + cmd + ' --issue ' + id + ' ...')
  setActiveCommand(cmd + ' #' + id)

  // Also start JSONL log tailing if available
  const logSSE = new SSEClient()
  logSSE.connect('/api/issues/' + id + '/logs', (data) => {
    appendActivity(data as any)
  })

  {
    sseClient.connect('/api/issues/' + id + '/run/' + cmd, (data) => {
      handleMsg(data)
      if (data.type === 'done' || data.type === 'error') {
        sseClient.close()
        logSSE.close()
      }
    }, () => {
      termLog('error', 'SSE connection lost')
      sseClient.close()
      logSSE.close()
      runningId = null
      pauseRefresh = false
      setActiveCommand(null)
      refreshBoard()
    })
  }
}

// ── Auto command ─────────────────────────────────────────────────────────────

const autoBtn = document.getElementById('btn-auto') as HTMLButtonElement | null

function setAutoBtn(mode: 'auto' | 'stop'): void {
  if (!autoBtn) return
  if (mode === 'stop') {
    autoBtn.textContent = '\u25A0 Stop'
    autoBtn.classList.add('active')
  } else {
    autoBtn.textContent = '\u25B6 Auto'
    autoBtn.classList.remove('active')
  }
}

function resetAfterAuto(): void {
  runningId = null
  pauseRefresh = false
  setAutoBtn('auto')
  setActiveCommand(null)
  fetchIssues()
}

function stopAutoRun(): void {
  api.stopActive()
  sseClient.close()
  termLog('info', 'Stopped.')
  resetAfterAuto()
}

function runAuto(): void {
  if (runningId !== null) {
    stopAutoRun()
    return
  }
  stopActive()
  pauseRefresh = true
  runningId = '__auto__'
  refreshBoard()
  openActivityPanel('barf auto')
  clearLog()
  termLog('info', 'Starting barf auto ...')
  setActiveCommand('auto')
  setAutoBtn('stop')

  sseClient.connect('/api/auto', (data) => {
    handleMsg(data)
    if (data.type === 'done' || data.type === 'error') {
      sseClient.close()
      resetAfterAuto()
    }
  }, () => {
    termLog('error', 'SSE connection lost')
    sseClient.close()
    resetAfterAuto()
    refreshBoard()
  })
}

autoBtn?.addEventListener('click', runAuto)

// ── New Issue Modal ──────────────────────────────────────────────────────────

document.getElementById('btn-new')?.addEventListener('click', () => {
  ;(document.getElementById('modal-ttl') as HTMLInputElement).value = ''
  ;(document.getElementById('modal-bdy') as HTMLTextAreaElement).value = ''
  document.getElementById('modal-ov')!.classList.add('open')
  setTimeout(() => (document.getElementById('modal-ttl') as HTMLInputElement).focus(), 50)
})

document.getElementById('modal-ov')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('modal-ov')!.classList.remove('open')
})

document.getElementById('modal-cancel')?.addEventListener('click', () => {
  document.getElementById('modal-ov')!.classList.remove('open')
})

document.getElementById('modal-ttl')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitNewIssue()
})

document.getElementById('modal-submit')?.addEventListener('click', submitNewIssue)

async function submitNewIssue(): Promise<void> {
  const titleInput = document.getElementById('modal-ttl') as HTMLInputElement
  const bodyInput = document.getElementById('modal-bdy') as HTMLTextAreaElement
  const title = titleInput.value.trim()
  const body = bodyInput.value.trim()
  if (!title) {
    titleInput.focus()
    return
  }
  try {
    await api.createIssue(title, body || undefined)
    document.getElementById('modal-ov')!.classList.remove('open')
    await fetchIssues()
  } catch (e) {
    alert('Create failed: ' + (e instanceof Error ? e.message : String(e)))
  }
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('config-ov')!.classList.contains('open')) {
      document.getElementById('config-ov')!.classList.remove('open')
      return
    }
    if (document.getElementById('modal-ov')!.classList.contains('open')) {
      document.getElementById('modal-ov')!.classList.remove('open')
      return
    }
    if (!document.getElementById('app')!.classList.contains('no-sidebar')) {
      closeSidebar()
      selectedId = null
      return
    }
  }
  if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement === document.body) {
    document.getElementById('btn-new')!.click()
  }
})

// ── Start ────────────────────────────────────────────────────────────────────
fetchIssues()
scheduleRefresh()
