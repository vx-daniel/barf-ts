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
    <div id="header">
      <h1>{'\u25C8'} barf dashboard</h1>
      <span id="project-path">{models.value?.projectCwd ?? ''}</span>
      <button
        type="button"
        className={`hbtn${isRunning ? ' active' : ''}`}
        id="btn-auto"
        onClick={runAuto}
      >
        {isRunning ? '\u25A0 Stop' : '\u25B6 Auto'}
      </button>
      <button
        type="button"
        className="hbtn"
        id="btn-new"
        onClick={() => {
          newIssueOpen.value = true
        }}
      >
        + New Issue
      </button>
      <button
        type="button"
        className="hbtn"
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
