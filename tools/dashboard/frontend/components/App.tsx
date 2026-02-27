/**
 * Root application component — composes all dashboard panels and handles
 * global keyboard shortcuts. Mounted into `#app` by {@link main.tsx}.
 */

import { ActivityLog } from '@dashboard/frontend/components/ActivityLog'
import { ConfigPanel } from '@dashboard/frontend/components/ConfigPanel'
import { EditorSidebar } from '@dashboard/frontend/components/EditorSidebar'
import { Header } from '@dashboard/frontend/components/Header'
import { InterviewModal } from '@dashboard/frontend/components/InterviewModal'
import { KanbanBoard } from '@dashboard/frontend/components/KanbanBoard'
import { NewIssueModal } from '@dashboard/frontend/components/NewIssueModal'
import { StatusBar } from '@dashboard/frontend/components/StatusBar'
import {
  configOpen,
  newIssueOpen,
  selectedId,
} from '@dashboard/frontend/lib/state'
import { useEffect } from 'preact/hooks'

export function App() {
  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (configOpen.value) {
          configOpen.value = false
          return
        }
        if (newIssueOpen.value) {
          newIssueOpen.value = false
          return
        }
        if (selectedId.value) {
          selectedId.value = null
          return
        }
      }
      if (
        e.key === 'n' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement === document.body
      ) {
        newIssueOpen.value = true
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Header />
      <div
        id="statusbar"
        className="flex items-center gap-3xl px-3xl py-sm bg-base-200 border-b border-neutral text-sm min-h-0 overflow-hidden"
        style={{ gridArea: 'statusbar' }}
      >
        <StatusBar />
      </div>
      <div
        id="main"
        className="flex flex-col overflow-hidden"
        style={{ gridArea: 'main' }}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-3xl py-xl">
          <div className="flex gap-lg h-full items-start">
            <KanbanBoard />
          </div>
        </div>
      </div>
      <EditorSidebar />
      <ActivityLog />
      <NewIssueModal />
      <InterviewModal />
      <ConfigPanel />
    </>
  )
}
