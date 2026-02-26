/**
 * Persistent status bar — always visible between header and board.
 *
 * Two modes:
 * - **Summary mode** (default): shows issue counts by state + total tokens
 * - **Issue mode** (when an issue is selected): shows that issue's stats
 *
 * Active command indicator overlays on top in either mode.
 */
import type { Issue } from '../lib/types'

let timerInterval: ReturnType<typeof setInterval> | null = null
let commandStartTime: number | null = null

function el(tag: string, cls?: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  return e
}

const STATE_COLORS: Record<string, string> = {
  NEW: '#6b7280',
  PLANNED: '#f59e0b',
  IN_PROGRESS: '#f97316',
  COMPLETED: '#22c55e',
  VERIFIED: '#10b981',
  STUCK: '#ef4444',
  SPLIT: '#a855f7',
}

export function mountStatus(container: HTMLElement): void {
  container.textContent = ''
  container.classList.remove('hidden')

  // Active command section
  const cmdSection = el('div')
  cmdSection.id = 'sb-command'
  const spinner = el('div', 'spinner')
  cmdSection.appendChild(spinner)
  const cmdText = el('span')
  cmdText.id = 'sb-cmd-text'
  cmdSection.appendChild(cmdText)
  const cmdTimer = el('span')
  cmdTimer.id = 'sb-cmd-timer'
  cmdSection.appendChild(cmdTimer)
  container.appendChild(cmdSection)

  // Summary section (issue counts by state) — visible by default
  const summary = el('div')
  summary.id = 'sb-summary'
  summary.className = 'sb-summary visible'
  container.appendChild(summary)

  // Selected issue section — hidden by default
  const issueSection = el('div')
  issueSection.id = 'sb-issue'
  const issueLabel = el('span', 'sb-issue-label')
  issueLabel.textContent = 'Issue:'
  issueSection.appendChild(issueLabel)
  const issueId = el('span')
  issueId.id = 'sb-issue-id'
  issueSection.appendChild(issueId)
  const issueTitle = el('span')
  issueTitle.id = 'sb-issue-title'
  issueSection.appendChild(issueTitle)
  container.appendChild(issueSection)

  // Stats (right-aligned)
  const stats = el('div', 'sb-stats')
  const statDefs = [
    { label: 'In', id: 'sb-st-input' },
    { label: 'Out', id: 'sb-st-output' },
    { label: 'Ctx', id: 'sb-st-context' },
    { label: 'Runs', id: 'sb-st-runs' },
    { label: 'Time', id: 'sb-st-duration' },
  ]
  for (const s of statDefs) {
    const stat = el('div', 'sb-stat')
    const lbl = el('span', 'sb-stat-label')
    lbl.textContent = s.label
    stat.appendChild(lbl)
    const val = el('span', 'sb-stat-value')
    val.id = s.id
    stat.appendChild(val)
    stats.appendChild(stat)
  }
  container.appendChild(stats)
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return seconds.toFixed(0) + 's'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/**
 * Update the summary section with issue counts by state.
 * Called on every refresh cycle.
 */
export function updateSummary(issues: Issue[]): void {
  const summary = document.getElementById('sb-summary')
  if (!summary) return
  summary.textContent = ''

  // Count by state
  const counts: Record<string, number> = {}
  let totalIn = 0
  let totalOut = 0
  for (const issue of issues) {
    counts[issue.state] = (counts[issue.state] ?? 0) + 1
    totalIn += issue.total_input_tokens
    totalOut += issue.total_output_tokens
  }

  // Render state chips
  const order = ['NEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'STUCK', 'SPLIT']
  for (const state of order) {
    const count = counts[state]
    if (!count) continue
    const chip = el('span', 'sb-state-chip')
    chip.style.borderColor = STATE_COLORS[state] ?? '#6b7280'
    chip.style.color = STATE_COLORS[state] ?? '#6b7280'
    chip.textContent = `${state.replace('_', ' ')} ${count}`
    summary.appendChild(chip)
  }

  // Update aggregate stats when no issue is selected
  const issueSection = document.getElementById('sb-issue')
  if (!issueSection?.classList.contains('visible')) {
    const stInput = document.getElementById('sb-st-input')
    const stOutput = document.getElementById('sb-st-output')
    const stContext = document.getElementById('sb-st-context')
    const stRuns = document.getElementById('sb-st-runs')
    const stDuration = document.getElementById('sb-st-duration')
    if (stInput) stInput.textContent = fmt(totalIn)
    if (stOutput) stOutput.textContent = fmt(totalOut)
    if (stContext) {
      stContext.textContent = String(issues.length) + ' issues'
      stContext.className = 'sb-stat-value'
    }
    if (stRuns) stRuns.textContent = String(issues.reduce((a, i) => a + i.run_count, 0))
    if (stDuration) {
      const totalSec = issues.reduce((a, i) => a + i.total_duration_seconds, 0)
      stDuration.textContent = fmtDuration(totalSec)
    }
  }
}

/**
 * Show stats for a specific selected issue, or revert to summary mode.
 */
export function updateStatus(issue: Issue | null, _models?: Record<string, string>): void {
  const issueSection = document.getElementById('sb-issue')
  const summary = document.getElementById('sb-summary')

  if (!issue) {
    issueSection?.classList.remove('visible')
    summary?.classList.add('visible')
    return
  }

  // Switch to issue mode
  issueSection?.classList.add('visible')
  summary?.classList.remove('visible')

  const issueId = document.getElementById('sb-issue-id')
  const issueTitle = document.getElementById('sb-issue-title')
  if (issueId) issueId.textContent = '#' + issue.id
  if (issueTitle) issueTitle.textContent = issue.title

  const stInput = document.getElementById('sb-st-input')
  const stOutput = document.getElementById('sb-st-output')
  const stContext = document.getElementById('sb-st-context')
  const stRuns = document.getElementById('sb-st-runs')
  const stDuration = document.getElementById('sb-st-duration')
  if (stInput) stInput.textContent = fmt(issue.total_input_tokens)
  if (stOutput) stOutput.textContent = fmt(issue.total_output_tokens)
  if (stContext) {
    const pct = issue.context_usage_percent
    stContext.textContent = pct != null ? pct + '%' : '\u2014'
    stContext.className = 'sb-stat-value'
    if (pct != null) {
      if (pct > 80) stContext.classList.add('danger')
      else if (pct > 60) stContext.classList.add('warning')
      else stContext.classList.add('healthy')
    }
  }
  if (stRuns) stRuns.textContent = String(issue.run_count)
  if (stDuration) stDuration.textContent = fmtDuration(issue.total_duration_seconds)
}

export function setActiveCommand(cmd: string | null): void {
  const cmdEl = document.getElementById('sb-command')
  const cmdText = document.getElementById('sb-cmd-text')
  const cmdTimer = document.getElementById('sb-cmd-timer')

  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  if (!cmd) {
    cmdEl?.classList.remove('visible')
    commandStartTime = null
    return
  }

  cmdEl?.classList.add('visible')
  if (cmdText) cmdText.textContent = cmd
  if (cmdTimer) cmdTimer.textContent = '0s'
  commandStartTime = Date.now()

  timerInterval = setInterval(() => {
    if (cmdTimer && commandStartTime) {
      const elapsed = Math.floor((Date.now() - commandStartTime) / 1000)
      cmdTimer.textContent = fmtDuration(elapsed)
    }
  }, 1000)
}
