/**
 * Activity log panel — expandable bottom panel with unified timeline.
 * Each event kind gets distinct visual treatment: stdout groups, tool cards,
 * state banners, and a cumulative token counter in the header.
 */
import type { ActivityEntry, ActivityKind } from '@dashboard/frontend/lib/types'
import { el } from '@dashboard/frontend/lib/dom'

const VISIBLE_KINDS = new Set<ActivityKind>([
  'stdout',
  'stderr',
  'tool_call',
  'tool_result',
  'token_update',
  'result',
  'error',
])

let activeFilters = new Set<string>(VISIBLE_KINDS)

/** Cumulative token totals updated on each token_update event. */
let cumulativeTokens = { input: 0, output: 0 }

/** The active collapsible stdout container, or null if no group is open. */
let currentStdoutGroup: HTMLElement | null = null

/** tool_call cards awaiting their result, keyed by toolUseId. */
const pendingToolCards = new Map<string, HTMLElement>()

/**
 * Builds a `<details>` row with a standardized `<summary class="activity-summary">`.
 * Used by all non-tool entry renderers to keep the unified timeline format consistent.
 *
 * @param kind - ActivityKind for `data-kind` attribute and filter visibility
 * @param cssClass - CSS class on the `<details>` element
 * @param summaryChildren - Spans for the summary line (time, badge, name, msg, extras)
 * @param body - Optional expanded content; if null, `<details>` behaves as non-interactive
 * @param filterKey - Key checked against `activeFilters` to hide/show the row
 * @returns `ok(details)` — the mounted element, not yet appended to the DOM
 */
function makeDetailsRow(
  kind: string,
  cssClass: string,
  summaryChildren: HTMLElement[],
  body: HTMLElement | null,
  filterKey: string,
): HTMLElement {
  const details = document.createElement('details')
  details.className = cssClass
  details.dataset.kind = kind

  const summary = document.createElement('summary')
  summary.className = 'activity-summary'
  for (const child of summaryChildren) summary.appendChild(child)
  details.appendChild(summary)

  if (body) details.appendChild(body)
  if (!activeFilters.has(filterKey)) details.style.display = 'none'
  return details
}

function timeSpan(ts: number): HTMLElement {
  const s = el('span', 'log-time')
  s.textContent = fmtTime(ts)
  return s
}

function levelSpan(text: string, cls: string): HTMLElement {
  const s = el('span', `pino-level ${cls}`)
  s.textContent = `[${text}]`
  return s
}

function jsonBody(data: unknown): HTMLElement {
  const pre = document.createElement('pre')
  pre.className = 'args-json'
  pre.textContent = JSON.stringify(data, null, 2)
  return pre
}

function issueSpan(entry: ActivityEntry): HTMLElement | null {
  if (!entry.issueId) return null
  const s = el('span', 'pino-issue-id')
  s.textContent = `#${entry.issueId}${entry.issueName ? `:${entry.issueName}` : ''}`
  return s
}

/**
 * Mounts the activity log UI (header, filters, log area, term input) into `container`.
 * Should be called once at startup; subsequent activity is appended via {@link appendActivity}.
 *
 * @param container - The DOM element to mount the panel into
 */
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
        container.querySelectorAll('.filter-btn').forEach((b) => {
          b.classList.add('active')
        })
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
      ;(entry as HTMLElement).style.display = activeFilters.has(kind)
        ? ''
        : 'none'
    }
  }
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Closes the current stdout group so non-stdout events open a fresh group later. */
function closeStdoutGroup(): void {
  currentStdoutGroup = null
}

function appendStdoutLine(entry: ActivityEntry): void {
  const log = document.getElementById('activity-log')
  if (!log) return

  const line = String(entry.data.line ?? '')

  // State transition detection
  if (line.startsWith('__BARF_STATE__:')) {
    closeStdoutGroup()
    const state = line.slice('__BARF_STATE__:'.length).trim()
    const banner = el('div', 'state-banner')
    banner.dataset.kind = 'stdout'
    banner.textContent = `→ ${state}`
    log.appendChild(banner)
    log.scrollTop = log.scrollHeight
    return
  }

  // Open a new group if there isn't one
  if (!currentStdoutGroup) {
    const details = document.createElement('details')
    details.className = 'turn-group'
    details.dataset.kind = 'stdout'
    details.open = true

    const summary = document.createElement('summary')
    summary.className = 'turn-group-summary'
    summary.dataset.lineCount = '0'
    summary.dataset.startTime = fmtTime(entry.timestamp)
    if (entry.issueId) {
      summary.dataset.issueId = entry.issueId
      summary.dataset.issueName = entry.issueName ?? ''
    }
    updateGroupSummary(summary)
    details.appendChild(summary)

    log.appendChild(details)
    currentStdoutGroup = details
  }

  const summary = currentStdoutGroup.querySelector('summary') as HTMLElement
  const prevCount = parseInt(summary.dataset.lineCount ?? '0', 10)
  summary.dataset.lineCount = String(prevCount + 1)
  updateGroupSummary(summary)

  // Try to detect JSON lines for pretty-printing
  const trimmed = line.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      const pre = document.createElement('pre')
      pre.className = 'json-block'
      pre.textContent = JSON.stringify(parsed, null, 2)
      currentStdoutGroup.appendChild(pre)
      log.scrollTop = log.scrollHeight
      return
    } catch {
      /* not valid JSON, fall through */
    }
  }

  const lineEl = el('div', 'stdout-line')
  const timeSpan = el('span', 'gutter-time')
  timeSpan.textContent = fmtTime(entry.timestamp)
  const textSpan = el('span', 'line-text')
  textSpan.textContent = line
  lineEl.appendChild(timeSpan)
  lineEl.appendChild(textSpan)
  currentStdoutGroup.appendChild(lineEl)

  log.scrollTop = log.scrollHeight
}

function updateGroupSummary(summary: HTMLElement): void {
  const count = summary.dataset.lineCount ?? '0'
  const time = summary.dataset.startTime ?? ''
  const issueId = summary.dataset.issueId
  const issueName = summary.dataset.issueName
  const issueTag = issueId
    ? ` · #${issueId}${issueName ? `:${issueName}` : ''}`
    : ''
  summary.textContent = `◦ Claude output${issueTag} · ${count} line${count === '1' ? '' : 's'} · ${time}`
}

const PINO_LEVEL_NAMES: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
}

const PINO_INTERNAL_KEYS = new Set([
  'level',
  'time',
  'pid',
  'hostname',
  'name',
  'msg',
  'issueId',
])

interface PinoLog {
  levelName: string
  name: string
  msg: string
  issueId: string | undefined
  extra: Record<string, unknown>
}

function parsePinoLog(line: string): PinoLog | null {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>
    if (typeof obj.level !== 'number' || typeof obj.msg !== 'string')
      return null
    const extra: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (!PINO_INTERNAL_KEYS.has(k)) extra[k] = v
    }
    return {
      levelName: PINO_LEVEL_NAMES[obj.level] ?? String(obj.level),
      name: typeof obj.name === 'string' ? obj.name : '',
      msg: obj.msg,
      issueId: typeof obj.issueId === 'string' ? obj.issueId : undefined,
      extra,
    }
  } catch {
    return null
  }
}

function appendStderrLine(entry: ActivityEntry): void {
  closeStdoutGroup()
  const log = document.getElementById('activity-log')
  if (!log) return

  const rawLine = String(entry.data.line ?? '')
  const pino = parsePinoLog(rawLine)

  let details: HTMLElement
  if (pino) {
    const summaryChildren: HTMLElement[] = [timeSpan(entry.timestamp)]

    const lvlCls = `pino-level-${pino.levelName.toLowerCase()}`
    summaryChildren.push(levelSpan(pino.levelName, lvlCls))

    if (pino.issueId) {
      const title =
        typeof pino.extra.title === 'string' ? pino.extra.title : null
      const idSpan = el('span', 'pino-issue-id')
      idSpan.textContent = `#${pino.issueId}${title ? `:${title}` : ''}`
      summaryChildren.push(idSpan)
    }

    if (pino.name) {
      const nameBadge = el('span', 'pino-name')
      nameBadge.textContent = pino.name
      summaryChildren.push(nameBadge)
    }

    const msgSpan = el('span', 'pino-msg')
    msgSpan.textContent = pino.msg
    summaryChildren.push(msgSpan)

    const extraEntries = Object.entries(pino.extra).filter(
      ([k]) => k !== 'title',
    )
    if (extraEntries.length > 0) {
      const extraSpan = el('span', 'pino-extra')
      extraSpan.textContent = extraEntries
        .map(([k, v]) => `${k}:${v}`)
        .join('  ')
      summaryChildren.push(extraSpan)
    }

    let levelCls = ''
    if (pino.levelName === 'WARN') {
      levelCls = 'pino-warn'
    } else if (pino.levelName === 'ERROR' || pino.levelName === 'FATAL') {
      levelCls = 'pino-error'
    }
    const cssClass = `activity-row pino-row${levelCls ? ` ${levelCls}` : ''}`
    details = makeDetailsRow(
      'stderr',
      cssClass,
      summaryChildren,
      jsonBody(pino),
      'stderr',
    )
  } else {
    const children = [
      timeSpan(entry.timestamp),
      levelSpan('STDERR', 'pino-level-error'),
    ]
    const badge = issueSpan(entry)
    if (badge) children.push(badge)
    const msgSpan = el('span', 'pino-msg')
    msgSpan.textContent = rawLine
    children.push(msgSpan)
    details = makeDetailsRow(
      'stderr',
      'activity-row pino-row',
      children,
      null,
      'stderr',
    )
  }

  log.appendChild(details)
  log.scrollTop = log.scrollHeight
}

function resolveToolMeta(toolName: string): { cls: string; badgeText: string } {
  if (toolName === 'Task') return { cls: 'agent-card', badgeText: 'AGENT' }
  if (toolName === 'Skill') return { cls: 'skill-card', badgeText: 'SKILL' }
  return { cls: 'tool-card', badgeText: 'TOOL' }
}

/**
 * Extracts a short human-readable snippet from tool args for the summary line.
 * Shows the most meaningful single argument rather than dumping all args.
 */
function mainArgSnippet(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const truncate = (s: string, len = 60): string =>
    s.length > len ? `${s.slice(0, len)}…` : s

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const p = String(args.file_path ?? '')
      if (!p) return ''
      const parts = p.split('/').filter(Boolean)
      // Show last 2 path segments, or just filename if only 1
      return parts.slice(-2).join('/')
    }
    case 'Bash':
      return truncate(String(args.command ?? ''))
    case 'Glob':
      return String(args.pattern ?? '')
    case 'Grep':
      return String(args.pattern ?? '')
    case 'Task': {
      const desc = String(args.description ?? '')
      return truncate(desc || String(args.subagent_type ?? ''))
    }
    case 'Skill':
      return String(args.skill ?? '')
    default: {
      const first = Object.values(args)[0]
      return first !== undefined ? truncate(String(first)) : ''
    }
  }
}

function appendToolCard(entry: ActivityEntry): void {
  closeStdoutGroup()
  const log = document.getElementById('activity-log')
  if (!log) return

  const toolName = String(entry.data.tool ?? 'unknown')
  const toolUseId = entry.data.toolUseId as string | undefined
  const args = entry.data.args as Record<string, unknown> | undefined

  const { cls, badgeText } = resolveToolMeta(toolName)

  // Descriptive display name for agent/skill cards
  let displayName = toolName
  if (toolName === 'Task' && args?.subagent_type)
    displayName = String(args.subagent_type)
  else if (toolName === 'Skill' && args?.skill) displayName = String(args.skill)

  const details = document.createElement('details')
  details.className = `activity-row ${cls}`
  details.dataset.kind = 'tool_call'
  if (toolUseId) details.dataset.toolUseId = toolUseId

  // Summary: TIME  #ISSUE  [TOOL]  displayName  mainArg
  const summary = document.createElement('summary')
  summary.className = 'activity-summary'

  const tSpan = timeSpan(entry.timestamp)
  const issueBadge = issueSpan(entry)
  const badge = el('span', 'pino-level')
  badge.textContent = `[${badgeText}]`
  const nameSpan = el('span', 'pino-name')
  nameSpan.textContent = displayName
  summary.appendChild(tSpan)
  if (issueBadge) summary.appendChild(issueBadge)
  summary.appendChild(badge)
  summary.appendChild(nameSpan)

  if (args) {
    const snippet = mainArgSnippet(toolName, args)
    if (snippet) {
      const snippetSpan = el('span', 'pino-msg')
      snippetSpan.textContent = snippet
      summary.appendChild(snippetSpan)
    }
  }

  details.appendChild(summary)

  if (args) {
    const argsPre = document.createElement('pre')
    argsPre.className = 'args-json'
    argsPre.textContent = JSON.stringify(args, null, 2)
    details.appendChild(argsPre)
  }

  const resultSlot = el('div', 'result-slot')
  resultSlot.textContent = 'awaiting result…'
  details.appendChild(resultSlot)

  if (!activeFilters.has('tool_call')) details.style.display = 'none'

  log.appendChild(details)
  log.scrollTop = log.scrollHeight

  if (toolUseId) {
    pendingToolCards.set(toolUseId, details)
  }
}

function resolveToolCard(entry: ActivityEntry): void {
  const toolUseId = entry.data.toolUseId as string | undefined
  if (!toolUseId) return

  const card = pendingToolCards.get(toolUseId)
  if (!card) return

  pendingToolCards.delete(toolUseId)

  const resultSlot = card.querySelector('.result-slot') as HTMLElement | null
  if (!resultSlot) return

  const content = String(entry.data.content ?? '')
  const isError = entry.data.isError === true

  resultSlot.textContent = ''
  resultSlot.className = `result-slot${isError ? ' result-error' : ''}`

  const truncated = content.length > 500 ? `${content.slice(0, 500)}…` : content
  const pre = document.createElement('pre')
  pre.className = 'result-content'
  pre.textContent = truncated
  if (content.length > 500) pre.title = content
  resultSlot.appendChild(pre)
}

function updateTokenCounter(entry: ActivityEntry): void {
  cumulativeTokens.input += Number(entry.data.input_tokens ?? 0)
  cumulativeTokens.output += Number(entry.data.output_tokens ?? 0)

  const titleEl = document.getElementById('activity-title')
  if (titleEl) {
    titleEl.textContent = `Activity Log · in: ${cumulativeTokens.input.toLocaleString()} out: ${cumulativeTokens.output.toLocaleString()}`
  }

  // Inline token row in the log
  const log = document.getElementById('activity-log')
  if (!log) return

  const inp = entry.data.input_tokens ?? 0
  const out = entry.data.output_tokens ?? 0
  const cacheCreate = entry.data.cache_creation_input_tokens ?? 0
  const cacheRead = entry.data.cache_read_input_tokens ?? 0

  const msgSpan = el('span', 'pino-msg')
  msgSpan.textContent = `+${inp} in, +${out} out`

  const body = jsonBody({
    input_tokens: inp,
    output_tokens: out,
    cache_creation_input_tokens: cacheCreate,
    cache_read_input_tokens: cacheRead,
  })

  const tokenChildren = [timeSpan(entry.timestamp)]
  const tokenIssueBadge = issueSpan(entry)
  if (tokenIssueBadge) tokenChildren.push(tokenIssueBadge)
  tokenChildren.push(levelSpan('TOKENS', 'pino-level-tokens'), msgSpan)

  const details = makeDetailsRow(
    'token_update',
    'activity-row token-row',
    tokenChildren,
    body,
    'token_update',
  )

  log.appendChild(details)
  log.scrollTop = log.scrollHeight
}

function appendResultRow(entry: ActivityEntry): void {
  closeStdoutGroup()
  const log = document.getElementById('activity-log')
  if (!log) return

  const msgSpan = el('span', 'pino-msg')
  msgSpan.textContent = String(entry.data.result ?? '')

  const resultChildren = [
    timeSpan(entry.timestamp),
    levelSpan('RESULT', 'pino-level-result'),
  ]
  const resultIssueBadge = issueSpan(entry)
  if (resultIssueBadge) resultChildren.push(resultIssueBadge)
  resultChildren.push(msgSpan)

  const details = makeDetailsRow(
    'result',
    'activity-row result-row',
    resultChildren,
    jsonBody(entry.data),
    'result',
  )

  log.appendChild(details)
  log.scrollTop = log.scrollHeight
}

function appendErrorBanner(entry: ActivityEntry): void {
  closeStdoutGroup()
  const log = document.getElementById('activity-log')
  if (!log) return

  const errorText = String(entry.data.error ?? 'error')
  const msgSpan = el('span', 'pino-msg')
  msgSpan.textContent =
    errorText.length > 80 ? `${errorText.slice(0, 80)}…` : errorText

  const errorChildren = [
    timeSpan(entry.timestamp),
    levelSpan('ERROR', 'pino-level-error'),
  ]
  const errorIssueBadge = issueSpan(entry)
  if (errorIssueBadge) errorChildren.push(errorIssueBadge)
  errorChildren.push(msgSpan)

  const details = makeDetailsRow(
    'error',
    'activity-row error-row',
    errorChildren,
    jsonBody(entry.data),
    'error',
  )

  log.appendChild(details)
  log.scrollTop = log.scrollHeight
}

/**
 * Dispatches a single activity entry to the appropriate renderer based on its kind.
 * All SSE-delivered activity events flow through this function.
 *
 * @param entry - The activity entry to render
 */
export function appendActivity(entry: ActivityEntry): void {
  switch (entry.kind) {
    case 'stdout':
      appendStdoutLine(entry)
      break
    case 'stderr':
      appendStderrLine(entry)
      break
    case 'tool_call':
      appendToolCard(entry)
      break
    case 'tool_result':
      resolveToolCard(entry)
      break
    case 'token_update':
      updateTokenCounter(entry)
      break
    case 'result':
      appendResultRow(entry)
      break
    case 'error':
      appendErrorBanner(entry)
      break
  }
}

/**
 * Appends a styled terminal-style line (e.g. system message or user reply) to the log.
 *
 * @param type - CSS suffix used as `t-{type}` class for styling
 * @param text - The text content to display
 */
export function termLog(type: string, text: string): void {
  const log = document.getElementById('activity-log')
  if (!log) return
  const line = el('div', `t-${type}`)
  line.textContent = text
  log.appendChild(line)
  log.scrollTop = log.scrollHeight
}

/**
 * Clears all entries from the activity log and resets cumulative token counters.
 * Called when switching issues or starting a fresh agent run.
 */
export function clearLog(): void {
  const log = document.getElementById('activity-log')
  if (log) log.textContent = ''
  currentStdoutGroup = null
  pendingToolCards.clear()
  cumulativeTokens = { input: 0, output: 0 }
  const titleEl = document.getElementById('activity-title')
  if (titleEl) titleEl.textContent = 'Activity Log'
}

/**
 * Shows or hides the terminal answer-input row used during interactive interviews.
 *
 * @param show - When `true`, reveals the input and focuses it; `false` hides it
 */
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

/**
 * Expands the activity panel and optionally updates the header title.
 *
 * @param title - Optional override for the panel title (e.g. issue name while running)
 */
export function openActivityPanel(title?: string): void {
  const bottom = document.getElementById('bottom')
  if (bottom) bottom.classList.add('open')
  const titleEl = document.getElementById('activity-title')
  if (titleEl && title) titleEl.textContent = title
}

/**
 * Collapses the activity panel without clearing its contents.
 */
export function closeActivityPanel(): void {
  const bottom = document.getElementById('bottom')
  if (bottom) bottom.classList.remove('open')
}
