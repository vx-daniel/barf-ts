/**
 * Sidebar — thin shell that toggles between IssuePanel and PromptsPanel
 * based on the `sidebarMode` signal.
 */

import { IssuePanel } from '@dashboard/frontend/components/IssuePanel'
import { PromptsPanel } from '@dashboard/frontend/components/PromptsPanel'
import { selectedId, sidebarMode } from '@dashboard/frontend/lib/state'
import { useCallback, useEffect } from 'preact/hooks'

export function Sidebar() {
  const id = selectedId.value
  const mode = sidebarMode.value

  const isVisible = mode === 'prompts' || id !== null

  // Toggle sidebar grid layout on #app
  useEffect(() => {
    const app = document.getElementById('app')
    if (!app) return
    if (!isVisible) {
      app.classList.add('no-sidebar', 'grid-cols-[1fr]')
      app.classList.remove('grid-cols-[1fr_30vw]')
      app.style.gridTemplateColumns = ''
      app.style.gridTemplateAreas = "'header' 'statusbar' 'main' 'bottom'"
    } else {
      app.classList.remove('no-sidebar', 'grid-cols-[1fr]')
      app.classList.add('grid-cols-[1fr_30vw]')
      app.style.gridTemplateAreas =
        "'header header' 'statusbar statusbar' 'main sidebar' 'bottom bottom'"
    }
  }, [isVisible])

  const handleClose = useCallback(() => {
    if (mode === 'prompts') {
      sidebarMode.value = 'issue'
    }
    selectedId.value = null
  }, [mode])

  if (!isVisible) return null

  return (
    <div
      id="sidebar"
      className="relative flex flex-col h-full bg-base-200 border-l border-neutral min-w-[30vw] overflow-hidden"
      style={{ gridArea: 'sidebar' }}
    >
      {mode === 'prompts' ? (
        <PromptsPanel onClose={handleClose} />
      ) : (
        <IssuePanel onClose={handleClose} />
      )}
    </div>
  )
}
