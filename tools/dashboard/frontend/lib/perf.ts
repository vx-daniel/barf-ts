/**
 * On-demand performance profiling for dashboard components via `preact-perf-profiler`.
 *
 * Call {@link enableProfiling} to start tracking render timings (visible in
 * Chrome DevTools Performance tab) and {@link disableProfiling} to stop.
 */
import { track, untrack } from 'preact-perf-profiler'

import { ActivityLog } from '@dashboard/frontend/components/ActivityLog'
import { App } from '@dashboard/frontend/components/App'
import { ConfigPanel } from '@dashboard/frontend/components/ConfigPanel'
import { EditorSidebar } from '@dashboard/frontend/components/EditorSidebar'
import { Header } from '@dashboard/frontend/components/Header'
import { InterviewModal } from '@dashboard/frontend/components/InterviewModal'
import { KanbanBoard } from '@dashboard/frontend/components/KanbanBoard'
import { NewIssueModal } from '@dashboard/frontend/components/NewIssueModal'
import { SessionList } from '@dashboard/frontend/components/SessionList'
import { StatusBar } from '@dashboard/frontend/components/StatusBar'
import { profiling } from '@dashboard/frontend/lib/state'

const COMPONENTS = [
  ActivityLog,
  App,
  ConfigPanel,
  EditorSidebar,
  Header,
  InterviewModal,
  KanbanBoard,
  NewIssueModal,
  SessionList,
  StatusBar,
] as const

/** Registers all dashboard components for render timing measurement. */
export function enableProfiling(): void {
  for (const c of COMPONENTS) track(c)
  profiling.value = true
}

/** Unregisters all dashboard components from render timing measurement. */
export function disableProfiling(): void {
  for (const c of COMPONENTS) untrack(c)
  profiling.value = false
}

/** Toggles profiling on/off. */
export function toggleProfiling(): void {
  if (profiling.value) disableProfiling()
  else enableProfiling()
}
