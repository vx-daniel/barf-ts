/**
 * Top-level dashboard header bar with project path, auto-run toggle, and
 * modal-open buttons. Replaces the static `#header` block from `index.html`.
 *
 * Reads {@link runningId} to toggle the Auto button between start/stop states
 * and {@link models} to display the current project working directory.
 */

import { runAuto } from '@dashboard/frontend/lib/actions'
import {
  configOpen,
  models,
  newIssueOpen,
  runningId,
} from '@dashboard/frontend/lib/state'

export function Header(): preact.JSX.Element {
  const isRunning = runningId.value !== null

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
      <button
        type="button"
        className={`btn btn-outline btn-lg ${isRunning ? 'btn-secondary' : 'btn-primary'}`} // btn-ghost border-neutral
        id="btn-auto"
        onClick={runAuto}
      >
        {isRunning ? '🛑 Stop' : '🚀 Auto'}
      </button>
      <button type="button" class="btn btn-lg btn-outline btn-error">
        🛑 Stop
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
