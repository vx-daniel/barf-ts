/**
 * Status bar — reactive Preact component that replaces the imperative
 * `mountStatus` / `updateSummary` / `updateStatus` functions.
 *
 * Reads {@link issues}, {@link selectedId}, and {@link activeCommand} signals;
 * manages the elapsed-timer ticker with `useEffect` so no module-level
 * `setInterval` is needed.
 */

import { STATE_ORDER, stateColor } from '@dashboard/frontend/lib/constants'
import { fmt, fmtDuration } from '@dashboard/frontend/lib/format'
import {
  activeCommand,
  issues,
  selectedId,
} from '@dashboard/frontend/lib/state'
import { useEffect, useState } from 'preact/hooks'

/**
 * Persistent status bar between the header and the board.
 *
 * Two display modes:
 * - **Summary** (no issue selected): per-state chip counts + aggregate token stats
 * - **Issue** (issue selected): selected issue header + its individual stats
 *
 * An active-command overlay with a live elapsed timer appears in both modes.
 *
 * Mounted into the `#statusbar` element by `main.tsx`.
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

  function ctxClass(pct: number | null | undefined): string {
    if (pct == null) return ''
    if (pct > 80) return 'text-error'
    if (pct > 60) return 'text-warning'
    return 'text-success'
  }

  const stats = selected
    ? {
        in: fmt(selected.total_input_tokens),
        out: fmt(selected.total_output_tokens),
        ctx: ctxPct != null ? `${ctxPct}%` : '\u2014',
        ctxCls: ctxClass(ctxPct),
        runs: String(selected.run_count),
        time: fmtDuration(selected.total_duration_seconds),
      }
    : {
        in: fmt(totalIn),
        out: fmt(totalOut),
        ctx: `${String(allIssues.length)} issues`,
        ctxCls: '',
        runs: String(totalRuns),
        time: fmtDuration(totalDur),
      }

  const statDefs = [
    { label: 'In', value: stats.in, cls: '' },
    { label: 'Out', value: stats.out, cls: '' },
    { label: 'Ctx', value: stats.ctx, cls: stats.ctxCls },
    { label: 'Runs', value: stats.runs, cls: '' },
    { label: 'Time', value: stats.time, cls: '' },
  ]

  return (
    <>
      {/* Active command indicator */}
      <div
        className={`items-center gap-md px-lg py-[3px] rounded-default border ${
          active ? 'flex' : 'hidden'
        }`}
        style={{
          background:
            'color-mix(in srgb, var(--color-state-in-progress) 10%, transparent)',
          borderColor:
            'color-mix(in srgb, var(--color-state-in-progress) 30%, transparent)',
        }}
      >
        <span className="loading loading-spinner loading-xs text-warning" />
        <span className="text-state-in-progress font-semibold">
          {active ?? ''}
        </span>
        <span className="text-base-content/50">
          {active ? fmtDuration(elapsed) : ''}
        </span>
      </div>

      {/* Summary chips (when no issue selected) */}
      <div className={`items-center gap-sm ${selected ? 'hidden' : 'flex'}`}>
        {STATE_ORDER.filter((s) => counts[s]).map((state) => (
          <span
            key={state}
            className="badge badge-outline badge-sm font-semibold tracking-[0.04em] whitespace-nowrap"
            style={{ borderColor: stateColor(state), color: stateColor(state) }}
          >
            {state.replace('_', ' ')} {counts[state]}
          </span>
        ))}
      </div>

      {/* Selected issue info */}
      <div className={`items-center gap-xl ${selected ? 'flex' : 'hidden'}`}>
        <span className="text-base-content/50">Issue:</span>
        <span className="text-primary font-semibold">
          {selected ? `#${selected.id}` : ''}
        </span>
        <span className="text-base-content max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
          {selected?.title ?? ''}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-xl ml-auto">
        {statDefs.map(({ label, value, cls }) => (
          <div key={label} className="flex items-center gap-xs">
            <span className="text-base-content/50 text-xs uppercase tracking-[0.04em]">
              {label}
            </span>
            <span className={`font-semibold text-base-content ${cls}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
