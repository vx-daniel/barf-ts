/**
 * Business-logic actions — all command orchestration, SSE/WS lifecycle,
 * and issue operations live here so panels and components can import them
 * without taking a dependency on `main.ts`.
 *
 * Reads and mutates state exclusively through the signals in
 * {@link module:state}. Side-effectful I/O is performed via `api-client`.
 */
import * as api from '@dashboard/frontend/lib/api-client'
import { SSEClient } from '@dashboard/frontend/lib/sse-client'
import {
  activeCommand,
  activityEntries,
  activityOpen,
  activityTitle,
  auditGate,
  interviewTarget,
  issues,
  models,
  pauseRefresh,
  runningId,
  selectedId,
  selectedSessionId,
  sessions,
  termInputVisible,
  todoItems,
} from '@dashboard/frontend/lib/state'
import type { ProcessedEntry, TodoItem } from '@dashboard/frontend/lib/types'
import { WSClient } from '@dashboard/frontend/lib/ws-client'
import type { Issue } from '@/types/index'
import type { ActivityEntry } from '@/types/schema/activity-schema'

// ── Transport layer ───────────────────────────────────────────────────────────

/** SSE client for command stdout/stderr streams and the auto-loop stream. */
const sseClient = new SSEClient()

/** WebSocket client used for interactive command input (interview step). */
export const wsClient = new WSClient()

/**
 * Per-command JSONL log SSE, tailing `{issueId}.jsonl` during a command run.
 * Separate from `sseClient` so it can be closed independently.
 */
const logSSE = new SSEClient()

// ── Signal-based panel helpers ───────────────────────────────────────────────

/** Maximum activity entries kept in memory to prevent unbounded growth. */
const MAX_ACTIVITY_ENTRIES = 5000

let entryCounter = 0

/**
 * Live command entries accumulated while a dashboard-initiated command runs.
 * Always receives new entries from {@link pushActivity}; the visible
 * {@link activityEntries} signal only reflects this when no historical
 * session is selected.
 */
let liveEntries: ProcessedEntry[] = []

/** O(1) lookup from `toolUseId` → index in {@link liveEntries} for tool_result resolution. */
const toolCallIndex = new Map<string, number>()

/**
 * Publishes the current {@link liveEntries} to the visible signal when
 * no historical session is selected.
 */
function syncSignal(): void {
  if (selectedSessionId.value === null) {
    activityEntries.value = liveEntries
  }
}

/**
 * Trims {@link liveEntries} to {@link MAX_ACTIVITY_ENTRIES} and rebuilds the
 * {@link toolCallIndex} from the surviving entries.
 */
function trimIfNeeded(): void {
  if (liveEntries.length <= MAX_ACTIVITY_ENTRIES) return
  liveEntries = liveEntries.slice(-MAX_ACTIVITY_ENTRIES)
  toolCallIndex.clear()
  for (let i = 0; i < liveEntries.length; i++) {
    const e = liveEntries[i]
    if (e.kind === 'tool_call') {
      const id = e.data.toolUseId as string | undefined
      if (id) toolCallIndex.set(id, i)
    }
  }
}

/**
 * Converts a raw {@link ActivityEntry} into a keyed {@link ProcessedEntry}
 * and appends it to the live buffer.
 *
 * When no session is selected ({@link selectedSessionId} is `null`), also
 * pushes to the visible {@link activityEntries} signal. Otherwise the entry
 * is buffered silently so the user can browse historical sessions without
 * interruption.
 */
function pushActivity(entry: ActivityEntry): void {
  const key = `e-${entryCounter++}`

  if (entry.kind === 'tool_result') {
    const toolUseId = entry.data.toolUseId as string | undefined
    const idx = toolUseId ? toolCallIndex.get(toolUseId) : undefined
    if (idx !== undefined && liveEntries[idx]) {
      liveEntries = liveEntries.slice()
      liveEntries[idx] = {
        ...liveEntries[idx],
        toolResult: {
          content: String(entry.data.content ?? ''),
          isError: entry.data.isError === true,
        },
      }
      syncSignal()
    }
    return
  }

  const processed: ProcessedEntry = {
    key,
    kind: entry.kind,
    timestamp: entry.timestamp,
    issueId: entry.issueId,
    issueName: entry.issueName,
    data: entry.data,
  }

  liveEntries = [...liveEntries, processed]

  if (entry.kind === 'tool_call') {
    const toolUseId = entry.data.toolUseId as string | undefined
    if (toolUseId) toolCallIndex.set(toolUseId, liveEntries.length - 1)
  }

  extractTodoFromToolCall(entry)
  trimIfNeeded()
  syncSignal()
}

// ── Todo extraction ────────────────────────────────────────────────────────

const TASK_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TodoWrite'])

const VALID_TODO_STATUSES = new Set<TodoItem['status']>([
  'pending',
  'in_progress',
  'completed',
])

/**
 * Intercepts TaskCreate/TaskUpdate/TodoWrite tool calls from the SDK stream
 * and maintains the {@link todoItems} signal for the progress bar.
 */
function extractTodoFromToolCall(entry: ActivityEntry): void {
  if (entry.kind !== 'tool_call') return
  const tool = entry.data.tool as string
  if (!TASK_TOOLS.has(tool)) return
  const args = entry.data.args as Record<string, unknown> | undefined
  if (!args) return

  if (tool === 'TaskCreate') {
    const subject = String(args.subject ?? '')
    if (!subject) return
    const id = (entry.data.toolUseId as string) ?? `tmp-${Date.now()}`
    if (todoItems.value.some((t) => t.subject === subject)) return
    todoItems.value = [
      ...todoItems.value,
      {
        id,
        subject,
        status: 'pending',
        activeForm: typeof args.activeForm === 'string' ? args.activeForm : undefined,
      },
    ]
  } else if (tool === 'TaskUpdate') {
    const taskId = String(args.taskId ?? '')
    const status = args.status as string | undefined
    if (!taskId || !status) return
    if (!VALID_TODO_STATUSES.has(status as TodoItem['status'])) return
    todoItems.value = todoItems.value.map((t) =>
      t.id === taskId
        ? { ...t, status: status as TodoItem['status'] }
        : t,
    )
  } else if (tool === 'TodoWrite') {
    // TodoWrite sends an array of tasks — replace the full list
    const tasks = args.tasks as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(tasks)) return
    todoItems.value = tasks
      .filter((t) => typeof t.subject === 'string')
      .map((t, i) => ({
        id: String(t.id ?? i),
        subject: String(t.subject),
        status: VALID_TODO_STATUSES.has(t.status as TodoItem['status'])
          ? (t.status as TodoItem['status'])
          : 'pending',
        activeForm: typeof t.activeForm === 'string' ? t.activeForm : undefined,
      }))
  }
}

/**
 * Appends a synthetic terminal-style line to the activity log.
 *
 * @param type - CSS suffix used as `t-{type}` class for styling
 * @param text - The text content to display
 */
function logTerm(type: string, text: string): void {
  const key = `t-${entryCounter++}`
  const entry: ProcessedEntry = {
    key,
    kind: 'stdout',
    timestamp: Date.now(),
    data: {},
    termType: type,
    termText: text,
  }
  liveEntries = [...liveEntries, entry]
  trimIfNeeded()
  syncSignal()
}

function clearActivityLog(): void {
  liveEntries = []
  activityEntries.value = []
  todoItems.value = []
  entryCounter = 0
  toolCallIndex.clear()
  issueCtxCache = null
}

function openPanel(title?: string): void {
  activityOpen.value = true
  if (title) activityTitle.value = title
}

// ── Data fetching ─────────────────────────────────────────────────────────────

/**
 * Fetches the full issue list from the API and updates the {@link issues}
 * signal. Preact components subscribed to `issues.value` re-render automatically.
 *
 * @returns `Promise<void>` — errors are logged to the activity panel, not thrown
 */
export async function fetchIssues(): Promise<void> {
  try {
    issues.value = await api.fetchIssues()
  } catch (e) {
    logTerm(
      'error',
      `fetch issues: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

/**
 * Loads the `.barfrc` config and updates the {@link models} signal.
 *
 * @returns `Promise<void>`
 */
export async function fetchConfig(): Promise<void> {
  try {
    const c = await api.fetchConfig()
    models.value = c
  } catch {
    // Silently ignore — config is non-critical at boot
  }
}

// ── Issue operations ──────────────────────────────────────────────────────────

/**
 * Opens an issue card in the editor sidebar by setting the selected-issue signal.
 *
 * @param issue - The issue to display in the editor
 */
export function openCard(issue: Issue): void {
  selectedId.value = issue.id
}

/**
 * Navigates to an issue by ID, opening it in the editor if found.
 *
 * @param id - Issue ID to navigate to
 */
export function navigateToIssue(id: string): void {
  const issue = issues.value.find((i) => i.id === id)
  if (issue) openCard(issue)
}

/**
 * Transitions an issue to a new state via the API, then re-fetches issues.
 *
 * @param id - Issue ID to transition
 * @param to - Target state string
 */
export async function doTransition(id: string, to: string): Promise<void> {
  try {
    await api.transitionIssue(id, to)
    await fetchIssues()
  } catch (e) {
    logTerm(
      'error',
      `Transition failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

/**
 * Deletes an issue via the API, closes the editor sidebar, clears the
 * selection signal, and re-fetches the issue list.
 *
 * @param id - Issue ID to delete
 */
export async function deleteIssue(id: string): Promise<void> {
  try {
    await api.deleteIssue(id)
    selectedId.value = null
    await fetchIssues()
  } catch (e) {
    logTerm(
      'error',
      `Delete failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

// ── SSE / transport helpers ───────────────────────────────────────────────────

/**
 * Closes all open SSE and WebSocket connections and clears the input prompt.
 * Does NOT reset signal values — call {@link stopAndReset} or
 * {@link resetAfterAuto} afterwards if signal cleanup is also needed.
 */
function stopActive(): void {
  sseClient.close()
  wsClient.close()
  logSSE.close()
  termInputVisible.value = false
  activeCommand.value = null
}

/**
 * Fully stops an in-progress single-issue command: closes connections,
 * resets all running-state signals, and refreshes the issue list.
 */
export function stopAndReset(): void {
  api.stopActive().catch((e: unknown) => {
    logTerm(
      'error',
      `Stop request failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  })
  stopActive()
  logTerm('info', 'Stopped.')
  runningId.value = null
  pauseRefresh.value = false
  void fetchIssues()
}

/**
 * Resets all running-state signals after the auto-loop ends or is stopped.
 * Fetches a fresh issue list to reflect any changes made during the run.
 */
function resetAfterAuto(): void {
  runningId.value = null
  pauseRefresh.value = false
  activeCommand.value = null
  void fetchIssues()
}

/**
 * Stops the auto-loop by sending a stop request to the server, closing the
 * SSE connection, and resetting all running-state signals.
 */
function stopAutoRun(): void {
  api.stopActive().catch((e: unknown) => {
    logTerm(
      'error',
      `Stop request failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  })
  sseClient.close()
  logTerm('info', 'Stopped.')
  resetAfterAuto()
}

// ── Live stats ────────────────────────────────────────────────────────────────

/**
 * Applies a live token/context stats update from a `__BARF_STATS__:` line
 * into the issue list signal.
 *
 * @param stats - Parsed stats payload from the stdout stream
 */
function applyLiveStats(stats: {
  totalInputTokens: number
  totalOutputTokens: number
  contextSize: number
  contextUsagePercent?: number
}): void {
  const id = runningId.value
  if (!id) return

  issues.value = issues.value.map((issue) => {
    if (issue.id !== id) return issue
    return {
      ...issue,
      total_input_tokens: stats.totalInputTokens,
      total_output_tokens: stats.totalOutputTokens,
      context_usage_percent:
        stats.contextUsagePercent ?? issue.context_usage_percent,
    }
  })
}

// ── Command message handler ───────────────────────────────────────────────────

/** Cached issue context for the active command — avoids `find()` on every SSE message. */
let issueCtxCache: {
  id: string
  ctx: { issueId: string; issueName: string }
} | null = null

/**
 * Returns `{ issueId, issueName }` for the currently running issue, using a
 * cache to avoid scanning the issues array on every SSE message.
 */
function getIssueCtx():
  | { issueId: string; issueName: string }
  | Record<string, never> {
  const id = runningId.value
  if (!id || id === '__auto__') return {}
  if (issueCtxCache?.id === id) return issueCtxCache.ctx
  const issue = issues.value.find((i) => i.id === id)
  if (!issue) return {}
  issueCtxCache = { id, ctx: { issueId: issue.id, issueName: issue.title } }
  return issueCtxCache.ctx
}

/**
 * Processes a single message from the command SSE stream.
 *
 * @param data - Parsed JSON object from the SSE `data:` field
 */
function handleMsg(data: Record<string, unknown>): void {
  if (data.type === 'stdout') {
    const line = data.line as string
    if (line?.startsWith('__BARF_STATS__:')) {
      try {
        const stats = JSON.parse(line.slice('__BARF_STATS__:'.length))
        applyLiveStats(stats)
      } catch {
        /* malformed — ignore */
      }
      return
    }
    if (line?.trim()) {
      pushActivity({
        timestamp: Date.now(),
        source: 'command',
        kind: 'stdout',
        ...getIssueCtx(),
        data: { line },
      })
    }
  } else if (data.type === 'stderr' && (data.line as string)?.trim()) {
    pushActivity({
      timestamp: Date.now(),
      source: 'command',
      kind: 'stderr',
      ...getIssueCtx(),
      data: { line: data.line },
    })
  } else if (data.type === 'done') {
    onCommandDone(data.exitCode as number)
  } else if (data.type === 'error') {
    logTerm('error', `Error: ${data.message}`)
    runningId.value = null
    pauseRefresh.value = false
    termInputVisible.value = false
    activeCommand.value = null
  }
}

/**
 * Called when the command SSE stream emits a `done` event.
 *
 * @param exitCode - Process exit code; `0` indicates success
 */
function onCommandDone(exitCode: number): void {
  const ok = exitCode === 0
  logTerm(
    ok ? 'done' : 'error',
    ok ? 'Done (exit 0)' : `Failed (exit ${exitCode})`,
  )
  runningId.value = null
  pauseRefresh.value = false
  termInputVisible.value = false
  activeCommand.value = null
  void fetchIssues()
}

// ── Command runner ────────────────────────────────────────────────────────────

/**
 * Starts a `barf <cmd> --issue <id>` run over SSE. For the special
 * `"interview"` command, opens the interview modal via signal instead.
 *
 * @param id - Issue ID to run the command against
 * @param cmd - Command name (e.g. `"plan"`, `"build"`, `"audit"`, `"interview"`)
 */
export function runCommand(id: string, cmd: string): void {
  if (cmd === 'interview') {
    const issue = issues.value.find((i) => i.id === id)
    if (!issue) return
    interviewTarget.value = {
      issue,
      done: () => {
        void fetchIssues()
      },
    }
    return
  }

  stopActive()
  pauseRefresh.value = true
  runningId.value = id
  openPanel(`barf ${cmd} --issue ${id}`)
  clearActivityLog()
  logTerm('info', `Starting barf ${cmd} --issue ${id} ...`)
  activeCommand.value = `${cmd} #${id}`

  logSSE.connect(`/api/issues/${id}/logs`, (data) => {
    const entry = data as unknown as ActivityEntry
    const ctx = getIssueCtx()
    pushActivity({
      ...entry,
      issueId: entry.issueId ?? id,
      issueName:
        entry.issueName ?? ('issueName' in ctx ? ctx.issueName : undefined),
    })
    if (entry.kind === 'token_update') {
      const delta = {
        input: Number(entry.data.input_tokens ?? 0),
        output: Number(entry.data.output_tokens ?? 0),
      }
      issues.value = issues.value.map((i) =>
        i.id === id
          ? {
              ...i,
              total_input_tokens: i.total_input_tokens + delta.input,
              total_output_tokens: i.total_output_tokens + delta.output,
            }
          : i,
      )
    }
  })

  sseClient.connect(
    `/api/issues/${id}/run/${cmd}`,
    (data) => {
      handleMsg(data)
      if (data.type === 'done' || data.type === 'error') {
        sseClient.close()
        logSSE.close()
      }
    },
    () => {
      logTerm('error', 'SSE connection lost')
      sseClient.close()
      logSSE.close()
      runningId.value = null
      pauseRefresh.value = false
      activeCommand.value = null
    },
  )
}

// ── Auto-loop ─────────────────────────────────────────────────────────────────

/**
 * Starts the `barf auto` loop over SSE, or stops it if already running.
 * Toggling is based on the current value of {@link runningId}.
 */
export function runAuto(): void {
  if (runningId.value !== null) {
    stopAutoRun()
    return
  }
  stopActive()
  pauseRefresh.value = true
  runningId.value = '__auto__'
  openPanel('barf auto')
  clearActivityLog()
  logTerm('info', 'Starting barf auto ...')
  activeCommand.value = 'auto'

  sseClient.connect(
    '/api/auto',
    (data) => {
      handleMsg(data)
      if (data.type === 'done' || data.type === 'error') {
        sseClient.close()
        resetAfterAuto()
      }
    },
    () => {
      logTerm('error', 'SSE connection lost')
      sseClient.close()
      resetAfterAuto()
    },
  )
}

// ── Activity panel close ──────────────────────────────────────────────────────

/**
 * Handles the activity panel close: stops active connections and resets state.
 */
export function onActivityClose(): void {
  activityOpen.value = false
  stopActive()
  runningId.value = null
  pauseRefresh.value = false
}

// ── Session management ──────────────────────────────────────────────────────

/**
 * Fetches the session list from the API and updates the signal.
 */
export async function fetchSessions(): Promise<void> {
  try {
    const res = await fetch('/api/sessions')
    if (res.ok) {
      sessions.value = await res.json()
    }
  } catch {
    // Silently ignore — session list is best-effort
  }
}

/**
 * Selects a session in the browser and loads its activity entries.
 * For running sessions, starts SSE tailing. For completed sessions,
 * loads the full history via byte-range API.
 */
export async function selectSession(sessionId: string): Promise<void> {
  // Toggle: clicking the already-selected session returns to live view
  if (selectedSessionId.value === sessionId) {
    deselectSession()
    return
  }

  selectedSessionId.value = sessionId
  const session = sessions.value.find((s) => s.sessionId === sessionId)
  if (!session || !session.issueId) return

  activityOpen.value = true
  activityTitle.value = `${session.mode ?? 'session'} #${session.issueId}`
  activityEntries.value = []

  // Load historical entries via byte-range
  const params = new URLSearchParams({
    offset: String(session.streamOffset ?? 0),
  })
  if (session.streamEndOffset !== undefined) {
    params.set('end', String(session.streamEndOffset))
  }

  try {
    const res = await fetch(
      `/api/sessions/${session.issueId}/logs?${params.toString()}`,
    )
    if (res.ok) {
      let entries = (await res.json()) as Array<Record<string, unknown>>
      // Cap historical entries to prevent browser overload on long sessions
      if (entries.length > MAX_ACTIVITY_ENTRIES) {
        entries = entries.slice(-MAX_ACTIVITY_ENTRIES)
      }
      const processed: ProcessedEntry[] = entries.map((e, i) => ({
        key: `h-${i}`,
        kind: (e.kind as ProcessedEntry['kind']) ?? 'stdout',
        timestamp: (e.timestamp as number) ?? Date.now(),
        issueId: session.issueId,
        data: (e.data as Record<string, unknown>) ?? {},
      }))
      activityEntries.value = processed
    }
  } catch {
    // Silently ignore
  }

  // For running sessions, also start live tailing
  if (session.status === 'running') {
    logSSE.connect(`/api/issues/${session.issueId}/logs`, (data) => {
      const entry = data as unknown as ActivityEntry
      pushActivity({
        ...entry,
        issueId: session.issueId,
      })
    })
  }
}

/**
 * Deselects the current session and restores the live command stream view.
 */
export function deselectSession(): void {
  selectedSessionId.value = null
  activityEntries.value = liveEntries
  activityTitle.value = activeCommand.value
    ? `barf ${activeCommand.value}`
    : 'Activity Log'
}

/**
 * Stops a running session by PID.
 */
export async function stopSessionByPid(pid: number): Promise<void> {
  try {
    await fetch(`/api/sessions/${pid}/stop`, { method: 'POST' })
    await fetchSessions()
  } catch {
    // Silently ignore
  }
}

/**
 * Stops all running sessions by sending SIGTERM to each one.
 */
export async function stopAllSessions(): Promise<void> {
  const running = sessions.value.filter((s) => s.status === 'running')
  await Promise.all(running.map((s) => stopSessionByPid(s.pid)))
}

/**
 * Deletes a completed or crashed session from the index.
 */
export async function deleteSessionById(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    })
    if (selectedSessionId.value === sessionId) {
      selectedSessionId.value = null
    }
    await fetchSessions()
  } catch {
    // Silently ignore
  }
}

/**
 * Archives a completed or crashed session.
 */
export async function archiveSessionById(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/archive`, {
      method: 'POST',
    })
    if (selectedSessionId.value === sessionId) {
      selectedSessionId.value = null
    }
    await fetchSessions()
  } catch {
    // Silently ignore
  }
}

// ── Audit gate ─────────────────────────────────────────────────────────────

/**
 * Fetches the current audit gate state and updates the signal.
 */
export async function fetchAuditGate(): Promise<void> {
  try {
    const res = await fetch('/api/audit-gate')
    if (res.ok) {
      auditGate.value = await res.json()
    }
  } catch {
    // Silently ignore
  }
}

/**
 * Triggers the audit gate via the dashboard.
 */
export async function triggerAuditGate(): Promise<void> {
  try {
    const res = await fetch('/api/audit-gate/trigger', { method: 'POST' })
    if (res.ok) {
      await fetchAuditGate()
    } else {
      const data = await res.json()
      logTerm('error', `Audit gate trigger failed: ${data.error}`)
    }
  } catch (e) {
    logTerm(
      'error',
      `Audit gate trigger failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}

/**
 * Cancels the audit gate via the dashboard.
 */
export async function cancelAuditGate(): Promise<void> {
  try {
    const res = await fetch('/api/audit-gate/cancel', { method: 'POST' })
    if (res.ok) {
      await fetchAuditGate()
    } else {
      const data = await res.json()
      logTerm('error', `Audit gate cancel failed: ${data.error}`)
    }
  } catch (e) {
    logTerm(
      'error',
      `Audit gate cancel failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }
}
