/**
 * Activity log panel — expandable bottom panel with scrolling timeline.
 * Shows command stdout/stderr + SDK tool calls + token updates.
 */
import type { ActivityEntry, ActivityKind } from '../lib/types'

const VISIBLE_KINDS = new Set<ActivityKind>([
  'stdout',
  'stderr',
  'tool_call',
  'token_update',
  'result',
  'error',
])

let activeFilters = new Set<string>(VISIBLE_KINDS)

function el(tag: string, cls?: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  return e
}

export function mountActivityLog(container: HTMLElement): void {
  container.textContent = ''

  // Header
  const header = el('div')
  header.id = 'activity-header'

  const title = el('span')
  title.id = 'activity-title'
  title.textContent = 'Activity Log'
  header.appendChild(title)

  const controls = el('div')
  controls.id = 'activity-controls'

  const filterDefs = [
    { kind: 'all', label: 'All' },
    { kind: 'tool_call', label: 'Tools' },
    { kind: 'token_update', label: 'Tokens' },
    { kind: 'stdout', label: 'Output' },
    { kind: 'error', label: 'Errors' },
  ]
  for (const f of filterDefs) {
    const btn = el('button', 'filter-btn active') as HTMLButtonElement
    btn.dataset.kind = f.kind
    btn.textContent = f.label
    controls.appendChild(btn)
  }

  const closeBtn = el('button')
  closeBtn.id = 'activity-close'
  closeBtn.textContent = '\u2715'
  controls.appendChild(closeBtn)

  header.appendChild(controls)
  container.appendChild(header)

  // Log area
  const log = el('div')
  log.id = 'activity-log'
  container.appendChild(log)

  // Input row
  const inputRow = el('div')
  inputRow.id = 'term-input-row'
  const prompt = el('span')
  prompt.id = 'term-input-prompt'
  prompt.textContent = 'answer >'
  inputRow.appendChild(prompt)
  const input = document.createElement('input')
  input.id = 'term-input'
  input.type = 'text'
  input.autocomplete = 'off'
  input.spellcheck = false
  input.placeholder = 'type your answer and press Enter'
  inputRow.appendChild(input)
  container.appendChild(inputRow)

  // Filter buttons
  container.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = (btn as HTMLElement).dataset.kind
      if (kind === 'all') {
        activeFilters = new Set(VISIBLE_KINDS)
        container.querySelectorAll('.filter-btn').forEach((b) => b.classList.add('active'))
      } else if (kind) {
        if (activeFilters.has(kind)) {
          activeFilters.delete(kind)
          btn.classList.remove('active')
        } else {
          activeFilters.add(kind)
          btn.classList.add('active')
        }
      }
      refreshVisibility()
    })
  })
}

function refreshVisibility(): void {
  const log = document.getElementById('activity-log')
  if (!log) return
  for (const entry of log.children) {
    const kind = (entry as HTMLElement).dataset.kind
    if (kind) {
      ;(entry as HTMLElement).style.display = activeFilters.has(kind) ? '' : 'none'
    }
  }
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function appendActivity(entry: ActivityEntry): void {
  const log = document.getElementById('activity-log')
  if (!log) return

  const row = el('div', 'log-entry')
  row.dataset.kind = entry.kind

  const time = el('span', 'log-time')
  time.textContent = fmtTime(entry.timestamp)
  row.appendChild(time)

  const kind = el('span', 'log-kind ' + entry.kind)
  kind.textContent = entry.kind.replace('_', ' ')
  row.appendChild(kind)

  const msg = el('span', 'log-msg')
  msg.textContent = formatActivityData(entry)
  row.appendChild(msg)

  if (!activeFilters.has(entry.kind)) {
    row.style.display = 'none'
  }

  log.appendChild(row)
  log.scrollTop = log.scrollHeight
}

function formatActivityData(entry: ActivityEntry): string {
  switch (entry.kind) {
    case 'tool_call':
      return `${entry.data.tool ?? 'unknown tool'}`
    case 'token_update': {
      const inp = entry.data.input_tokens ?? 0
      const out = entry.data.output_tokens ?? 0
      return `in: ${inp}, out: ${out}`
    }
    case 'result':
      return `${entry.data.result ?? ''}`
    case 'error':
      return `${entry.data.error ?? ''}`
    case 'stdout':
    case 'stderr':
      return `${entry.data.line ?? ''}`
    default:
      return JSON.stringify(entry.data)
  }
}

export function termLog(type: string, text: string): void {
  const log = document.getElementById('activity-log')
  if (!log) return
  const line = el('div', 't-' + type)
  line.textContent = text
  log.appendChild(line)
  log.scrollTop = log.scrollHeight
}

export function clearLog(): void {
  const log = document.getElementById('activity-log')
  if (log) log.textContent = ''
}

export function setTermInput(show: boolean): void {
  const row = document.getElementById('term-input-row')
  if (row) {
    row.classList.toggle('visible', show)
    if (show) {
      const input = document.getElementById('term-input') as HTMLInputElement
      input.value = ''
      input.focus()
    }
  }
}

export function openActivityPanel(title?: string): void {
  const bottom = document.getElementById('bottom')
  if (bottom) bottom.classList.add('open')
  const titleEl = document.getElementById('activity-title')
  if (titleEl && title) titleEl.textContent = title
}

export function closeActivityPanel(): void {
  const bottom = document.getElementById('bottom')
  if (bottom) bottom.classList.remove('open')
}
