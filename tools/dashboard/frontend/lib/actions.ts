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
  interviewTarget,
  issues,
  models,
  pauseRefresh,
  runningId,
  selectedId,
  termInputVisible,
} from '@dashboard/frontend/lib/state'
import type {
  ActivityEntry,
  ProcessedEntry,
} from '@dashboard/frontend/lib/types'
import { WSClient } from '@dashboard/frontend/lib/ws-client'

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

let entryCounter = 0

/**
 * Converts a raw {@link ActivityEntry} into a keyed {@link ProcessedEntry}
 * and appends it to the {@link activityEntries} signal.
 * For `tool_result` entries, resolves the matching `tool_call` instead.
 */
function pushActivity(entry: ActivityEntry): void {
  const key = `e-${entryCounter++}`

  if (entry.kind === 'tool_result') {
    const toolUseId = entry.data.toolUseId as string | undefined
    if (toolUseId) {
      // Resolve into existing tool_call entry
      activityEntries.value = activityEntries.value.map((e) => {
        if (
          e.kind === 'tool_call' &&
          (e.data.toolUseId as string | undefined) === toolUseId
        ) {
          return {
            ...e,
            toolResult: {
              content: String(entry.data.content ?? ''),
              isError: entry.data.isError === true,
            },
          }
        }
        return e
      })
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
  activityEntries.value = [...activityEntries.value, processed]
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
  activityEntries.value = [...activityEntries.value, entry]
}

function clearActivityLog(): void {
  activityEntries.value = []
  entryCounter = 0
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

/**
 * Processes a single message from the command SSE stream.
 *
 * @param data - Parsed JSON object from the SSE `data:` field
 */
function handleMsg(data: Record<string, unknown>): void {
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
      pushActivity({
        timestamp: Date.now(),
        source: 'command',
        kind: 'stdout',
        ...issueCtx,
        data: { line },
      })
    }
  } else if (data.type === 'stderr' && (data.line as string)?.trim()) {
    pushActivity({
      timestamp: Date.now(),
      source: 'command',
      kind: 'stderr',
      ...issueCtx,
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
    const issue = issues.value.find((i) => i.id === id)
    pushActivity({
      ...entry,
      issueId: entry.issueId ?? id,
      issueName: entry.issueName ?? issue?.title,
    })
    if (entry.kind === 'token_update' && issue) {
      issues.value = issues.value.map((i) =>
        i.id === id
          ? {
              ...i,
              total_input_tokens:
                i.total_input_tokens + Number(entry.data.input_tokens ?? 0),
              total_output_tokens:
                i.total_output_tokens + Number(entry.data.output_tokens ?? 0),
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
