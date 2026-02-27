/**
 * Registers dashboard components with `preact-perf-profiler` so render timings
 * appear as User Timing marks in the browser DevTools Performance tab.
 *
 * Import this module for side effects only — no exports.
 */
import { track } from 'preact-perf-profiler'

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

track(ActivityLog)
track(App)
track(ConfigPanel)
track(EditorSidebar)
track(Header)
track(InterviewModal)
track(KanbanBoard)
track(NewIssueModal)
track(SessionList)
track(StatusBar)
