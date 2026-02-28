/**
 * Top-level dashboard header bar with project path, auto-run toggle, and
 * modal-open buttons. Replaces the static `#header` block from `index.html`.
 *
 * Reads {@link runningId} to toggle the Auto button between start/stop states
 * and {@link models} to display the current project working directory.
 */

import {
  cancelAuditGate,
  runAuto,
  stopAllSessions,
  triggerAuditGate,
} from '@dashboard/frontend/lib/actions'
import { toggleProfiling } from '@dashboard/frontend/lib/perf'
import {
  auditGate,
  configOpen,
  models,
  newIssueOpen,
  profiling,
  runningId,
} from '@dashboard/frontend/lib/state'

/** Labels and styles for each audit gate state. */
const GATE_LABELS = {
  running: null,
  draining: 'Draining...',
  auditing: 'Auditing...',
  fixing: 'Fixing...',
} as const

export function Header(): preact.JSX.Element {
  const isRunning = runningId.value !== null
  const gate = auditGate.value
  const gateActive = gate.state !== 'running'
  const gateLabel = GATE_LABELS[gate.state]

  return (
    <div
      id="header"
      className="flex items-center gap-xl px-3xl py-lg bg-base-200 border-b border-neutral"
      style={{ gridArea: 'header' }}
    >
      <h1 className="text-xl font-bold text-primary whitespace-nowrap">
        {'\u25C8'} barf dashboard
      </h1>
      <span className="text-base-content/50 text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {models.value?.projectCwd ?? ''}
      </span>
      {gateLabel && (
        <span className="badge badge-warning badge-lg gap-xs animate-pulse">
          {'\u{1F6E1}'} {gateLabel}
        </span>
      )}
      <button
        type="button"
        className={`btn btn-outline btn-sm ${gateActive ? 'btn-warning' : 'btn-accent'}`}
        onClick={gateActive ? cancelAuditGate : triggerAuditGate}
      >
        {gateActive ? 'Cancel Audit' : '\u{1F50D} Audit'}
      </button>
      <button
        type="button"
        className={`btn btn-outline btn-lg ${isRunning ? 'btn-secondary' : 'btn-primary'}`}
        id="btn-auto"
        onClick={runAuto}
      >
        {isRunning ? '🛑 Stop' : '🚀 Auto'}
      </button>
      <button
        type="button"
        className="btn btn-lg btn-outline btn-error"
        onClick={stopAllSessions}
      >
        🛑 Stop All
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost border-neutral"
        id="btn-new"
        onClick={() => {
          newIssueOpen.value = true
        }}
      >
        + New Issue
      </button>
      <button
        type="button"
        className={`btn btn-sm btn-ghost border-neutral ${profiling.value ? 'btn-active btn-warning' : ''}`}
        onClick={toggleProfiling}
        title="Toggle render profiling (visible in DevTools Performance tab)"
      >
        {profiling.value ? '\u{1F534} Profiling' : '\u23F1 Profile'}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-ghost border-neutral"
        id="btn-config"
        onClick={() => {
          configOpen.value = true
        }}
      >
        {'\u2699'} Config
      </button>
    </div>
  )
}
