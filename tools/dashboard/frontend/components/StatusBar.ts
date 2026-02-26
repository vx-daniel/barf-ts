/**
 * Status bar — reactive Preact component that replaces the imperative
 * `mountStatus` / `updateSummary` / `updateStatus` functions.
 *
 * Reads {@link issues}, {@link selectedId}, and {@link activeCommand} signals;
 * manages the elapsed-timer ticker with `useEffect` so no module-level
 * `setInterval` is needed.
 */
import { Fragment } from 'preact'
import { html } from 'htm/preact'
import { useState, useEffect } from 'preact/hooks'
import { issues, selectedId, activeCommand } from '@dashboard/frontend/lib/state'
import { STATE_ORDER, stateColor } from '@dashboard/frontend/lib/constants'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/**
 * Persistent status bar between the header and the board.
 *
 * Two display modes:
 * - **Summary** (no issue selected): per-state chip counts + aggregate token stats
 * - **Issue** (issue selected): selected issue header + its individual stats
 *
 * An active-command overlay with a live elapsed timer appears in both modes.
 *
 * Mounted into the `#statusbar` element by `main.ts`.
 */
export function StatusBar() {
  const active = activeCommand.value
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(0)
    if (!active) return
    const start = Date.now()
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    )
    return () => clearInterval(id)
  }, [active])

  const allIssues = issues.value
  const selected = allIssues.find((i) => i.id === selectedId.value) ?? null

  // Aggregate totals for summary mode
  const counts: Record<string, number> = {}
  let totalIn = 0
  let totalOut = 0
  let totalRuns = 0
  let totalDur = 0
  for (const issue of allIssues) {
    counts[issue.state] = (counts[issue.state] ?? 0) + 1
    totalIn += issue.total_input_tokens
    totalOut += issue.total_output_tokens
    totalRuns += issue.run_count
    totalDur += issue.total_duration_seconds
  }

  // Stat values vary by mode
  const ctxPct = selected?.context_usage_percent
  const stats = selected
    ? {
        in: fmt(selected.total_input_tokens),
        out: fmt(selected.total_output_tokens),
        ctx: ctxPct != null ? `${ctxPct}%` : '\u2014',
        ctxClass: ctxPct == null
          ? 'sb-stat-value'
          : ctxPct > 80 ? 'sb-stat-value danger'
          : ctxPct > 60 ? 'sb-stat-value warning'
          : 'sb-stat-value healthy',
        runs: String(selected.run_count),
        time: fmtDuration(selected.total_duration_seconds),
      }
    : {
        in: fmt(totalIn),
        out: fmt(totalOut),
        ctx: `${String(allIssues.length)} issues`,
        ctxClass: 'sb-stat-value',
        runs: String(totalRuns),
        time: fmtDuration(totalDur),
      }

  const statDefs = [
    { label: 'In', value: stats.in, cls: 'sb-stat-value' },
    { label: 'Out', value: stats.out, cls: 'sb-stat-value' },
    { label: 'Ctx', value: stats.ctx, cls: stats.ctxClass },
    { label: 'Runs', value: stats.runs, cls: 'sb-stat-value' },
    { label: 'Time', value: stats.time, cls: 'sb-stat-value' },
  ]

  return html`
    <${Fragment}>
      <div id="sb-command" class=${active ? 'visible' : ''}>
        <div class="spinner"></div>
        <span id="sb-cmd-text">${active ?? ''}</span>
        <span id="sb-cmd-timer">${active ? fmtDuration(elapsed) : ''}</span>
      </div>

      <div id="sb-summary" class=${`sb-summary${selected ? '' : ' visible'}`}>
        ${STATE_ORDER.filter((s) => counts[s]).map(
          (state) => html`
            <span
              key=${state}
              class="sb-state-chip"
              style=${{ borderColor: stateColor(state), color: stateColor(state) }}
            >
              ${state.replace('_', ' ')} ${counts[state]}
            </span>
          `,
        )}
      </div>

      <div id="sb-issue" class=${selected ? 'visible' : ''}>
        <span class="sb-issue-label">Issue:</span>
        <span id="sb-issue-id">${selected ? `#${selected.id}` : ''}</span>
        <span id="sb-issue-title">${selected?.title ?? ''}</span>
      </div>

      <div class="sb-stats">
        ${statDefs.map(
          ({ label, value, cls }) => html`
            <div key=${label} class="sb-stat">
              <span class="sb-stat-label">${label}</span>
              <span class=${cls}>${value}</span>
            </div>
          `,
        )}
      </div>
    <//>
  `
}
