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
import { WSClient } from '@dashboard/frontend/lib/ws-client'
import {
  issues,
  selectedId,
  runningId,
  pauseRefresh,
  models,
  activeCommand,
} from '@dashboard/frontend/lib/state'
import type { ActivityEntry, Issue } from '@dashboard/frontend/lib/types'
import {
  appendActivity,
  termLog,
  clearLog,
  setTermInput,
  openActivityPanel,
  closeActivityPanel,
} from '@dashboard/frontend/panels/activity-log'
import { openIssue, closeSidebar } from '@dashboard/frontend/panels/editor'
import { openInterview } from '@dashboard/frontend/panels/interview-modal'

// ── Transport layer ───────────────────────────────────────────────────────────
// Module-level singletons so stopActive() can always reach the live connection.

/** SSE client for command stdout/stderr streams and the auto-loop stream. */
export const sseClient = new SSEClient()

/** WebSocket client used for interactive command input (interview step). */
export const wsClient = new WSClient()

/**
 * Per-command JSONL log SSE, tailing `{issueId}.jsonl` during a command run.
 * Separate from `sseClient` so it can be closed independently.
 */
export const logSSE = new SSEClient()

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
    termLog('error', `fetch issues: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/**
 * Loads the `.barfrc` config, updates the {@link models} signal, and sets
 * the `#project-path` element text.
 *
 * @returns `Promise<void>`
 */
export async function fetchConfig(): Promise<void> {
  try {
    const c = await api.fetchConfig()
    models.value = c
    const pathEl = document.getElementById('project-path')
    if (pathEl && c.projectCwd) pathEl.textContent = c.projectCwd
  } catch {
    // Silently ignore — config is non-critical at boot
  }
}

// ── Issue operations ──────────────────────────────────────────────────────────

/**
 * Opens an issue card in the editor sidebar and updates the selected-issue
 * signal, which triggers the status bar to switch to issue mode.
 *
 * @param issue - The issue to display in the editor
 */
export function openCard(issue: Issue): void {
  selectedId.value = issue.id
  openIssue(issue)
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
 * Re-renders the editor sidebar with the latest data for the currently
 * selected issue. Called explicitly after commands finish to pick up
 * any server-side field updates. Not reactive — `openIssue` resets
 * CodeMirror and would discard unsaved edits on every poll cycle.
 */
export function refreshSidebar(): void {
  if (selectedId.value) {
    const issue = issues.value.find((i) => i.id === selectedId.value)
    if (issue) openIssue(issue)
  }
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
    termLog('error', `Transition failed: ${e instanceof Error ? e.message : String(e)}`)
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
    closeSidebar()
    selectedId.value = null
    await fetchIssues()
  } catch (e) {
    termLog('error', `Delete failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── SSE / transport helpers ───────────────────────────────────────────────────

/**
 * Closes all open SSE and WebSocket connections and clears the input prompt.
 * Does NOT reset signal values — call {@link stopAndReset} or
 * {@link resetAfterAuto} afterwards if signal cleanup is also needed.
 */
export function stopActive(): void {
  sseClient.close()
  wsClient.close()
  logSSE.close()
  setTermInput(false)
  activeCommand.value = null
}

/**
 * Fully stops an in-progress single-issue command: closes connections,
 * resets all running-state signals, and refreshes the board and sidebar.
 */
export function stopAndReset(): void {
  api.stopActive().catch((e: unknown) => {
    termLog('error', `Stop request failed: ${e instanceof Error ? e.message : String(e)}`)
  })
  stopActive()
  termLog('info', 'Stopped.')
  runningId.value = null
  pauseRefresh.value = false
  refreshSidebar()
  void fetchIssues()
}

/**
 * Resets all running-state signals after the auto-loop ends or is stopped.
 * Fetches a fresh issue list to reflect any changes made during the run.
 */
export function resetAfterAuto(): void {
  runningId.value = null
  pauseRefresh.value = false
  setAutoBtn('auto')
  activeCommand.value = null
  void fetchIssues()
}

/**
 * Stops the auto-loop by sending a stop request to the server, closing the
 * SSE connection, and resetting all running-state signals.
 */
export function stopAutoRun(): void {
  api.stopActive().catch((e: unknown) => {
    termLog('error', `Stop request failed: ${e instanceof Error ? e.message : String(e)}`)
  })
  sseClient.close()
  termLog('info', 'Stopped.')
  resetAfterAuto()
}

// ── Live stats ────────────────────────────────────────────────────────────────

/**
 * Applies a live token/context stats update from a `__BARF_STATS__:` line
 * into the issue list signal. Creates a new array with an updated issue object
 * so Preact components detect the change and re-render.
 *
 * @param stats - Parsed stats payload from the stdout stream
 */
export function applyLiveStats(stats: {
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

/**
 * Processes a single message from the command SSE stream and dispatches it
 * to the appropriate handler (stats update, activity log append, or done/error).
 *
 * @param data - Parsed JSON object from the SSE `data:` field
 */
export function handleMsg(data: Record<string, unknown>): void {
  const activeIssue =
    runningId.value && runningId.value !== '__auto__'
      ? issues.value.find((i) => i.id === runningId.value)
      : undefined
  const issueCtx = activeIssue
    ? { issueId: activeIssue.id, issueName: activeIssue.title }
    : {}

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
      appendActivity({
        timestamp: Date.now(),
        source: 'command',
        kind: 'stdout',
        ...issueCtx,
        data: { line },
      })
    }
  } else if (data.type === 'stderr' && (data.line as string)?.trim()) {
    appendActivity({
      timestamp: Date.now(),
      source: 'command',
      kind: 'stderr',
      ...issueCtx,
      data: { line: data.line },
    })
  } else if (data.type === 'done') {
    onCommandDone(data.exitCode as number)
  } else if (data.type === 'error') {
    termLog('error', `Error: ${data.message}`)
    runningId.value = null
    pauseRefresh.value = false
    setTermInput(false)
    activeCommand.value = null
  }
}

/**
 * Called when the command SSE stream emits a `done` event. Resets all
 * running-state signals, refreshes the sidebar and issue list, and updates
 * the auto button to its idle state.
 *
 * @param exitCode - Process exit code; `0` indicates success
 */
function onCommandDone(exitCode: number): void {
  const ok = exitCode === 0
  termLog(ok ? 'done' : 'error', ok ? 'Done (exit 0)' : `Failed (exit ${exitCode})`)
  runningId.value = null
  pauseRefresh.value = false
  setTermInput(false)
  activeCommand.value = null
  setAutoBtn('auto')
  refreshSidebar()
  void fetchIssues()
}

// ── Command runner ────────────────────────────────────────────────────────────

/**
 * Starts a `barf <cmd> --issue <id>` run over SSE. Also tails the issue's
 * JSONL log for live token updates. For the special `"interview"` command,
 * opens the interview modal instead of spawning a subprocess.
 *
 * @param id - Issue ID to run the command against
 * @param cmd - Command name (e.g. `"plan"`, `"build"`, `"audit"`, `"interview"`)
 */
export function runCommand(id: string, cmd: string): void {
  if (cmd === 'interview') {
    const issue = issues.value.find((i) => i.id === id)
    if (!issue) return
    openInterview(issue, () => {
      void fetchIssues()
      if (selectedId.value === id) {
        const updated = issues.value.find((i) => i.id === id)
        if (updated) openIssue(updated)
      }
    })
    return
  }

  stopActive()
  pauseRefresh.value = true
  runningId.value = id
  refreshSidebar()
  openActivityPanel(`barf ${cmd} --issue ${id}`)
  clearLog()
  termLog('info', `Starting barf ${cmd} --issue ${id} ...`)
  activeCommand.value = `${cmd} #${id}`

  logSSE.connect(`/api/issues/${id}/logs`, (data) => {
    const entry = data as unknown as ActivityEntry
    const issue = issues.value.find((i) => i.id === id)
    appendActivity({
      ...entry,
      issueId: entry.issueId ?? id,
      issueName: entry.issueName ?? issue?.title,
    })
    if (entry.kind === 'token_update' && issue) {
      // Immutable update so Preact components detect the change
      issues.value = issues.value.map((i) =>
        i.id === id
          ? {
              ...i,
              total_input_tokens: i.total_input_tokens + Number(entry.data.input_tokens ?? 0),
              total_output_tokens: i.total_output_tokens + Number(entry.data.output_tokens ?? 0),
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
      termLog('error', 'SSE connection lost')
      sseClient.close()
      logSSE.close()
      runningId.value = null
      pauseRefresh.value = false
      activeCommand.value = null
    },
  )
}

// ── Auto-loop ─────────────────────────────────────────────────────────────────

/** Reference to the Auto button; updated by {@link setAutoBtn}. */
const autoBtn = document.getElementById('btn-auto') as HTMLButtonElement | null

/**
 * Toggles the Auto button between its running (`■ Stop`) and idle (`▶ Auto`)
 * visual states.
 *
 * @param mode - `'auto'` for idle state, `'stop'` for running state
 */
export function setAutoBtn(mode: 'auto' | 'stop'): void {
  if (!autoBtn) return
  if (mode === 'stop') {
    autoBtn.textContent = '\u25A0 Stop'
    autoBtn.classList.add('active')
  } else {
    autoBtn.textContent = '\u25B6 Auto'
    autoBtn.classList.remove('active')
  }
}

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
  openActivityPanel('barf auto')
  clearLog()
  termLog('info', 'Starting barf auto ...')
  activeCommand.value = 'auto'
  setAutoBtn('stop')

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
      termLog('error', 'SSE connection lost')
      sseClient.close()
      resetAfterAuto()
    },
  )
}

// ── Activity panel close ──────────────────────────────────────────────────────

/**
 * Handles the activity panel close button: closes the panel, stops any
 * active SSE connection, and resets running state.
 */
export function onActivityClose(): void {
  closeActivityPanel()
  stopActive()
  runningId.value = null
  pauseRefresh.value = false
}

// ── New issue ─────────────────────────────────────────────────────────────────

/**
 * Submits the new-issue modal form, creating an issue via the API and
 * refreshing the issue list on success.
 *
 * @returns `Promise<void>` — errors are logged to the activity panel
 */
export async function submitNewIssue(): Promise<void> {
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
    document.getElementById('modal-ov')?.classList.remove('open')
    await fetchIssues()
  } catch (e) {
    termLog('error', `Create failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}
