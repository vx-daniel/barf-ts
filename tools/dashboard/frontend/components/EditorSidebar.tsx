/**
 * Editor sidebar — Preact JSX replacement for the imperative `panels/editor.ts`.
 *
 * Reads reactive signals for selected issue, issue list, and running state.
 * Renders header, state row, relationships, tabbed content (preview / edit /
 * metadata), and action buttons.
 */

import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { ActionButton } from '@dashboard/frontend/components/ActionButton'
import {
  deleteIssue,
  navigateToIssue,
  runCommand,
  stopAndReset,
} from '@dashboard/frontend/lib/actions'
import * as api from '@dashboard/frontend/lib/api-client'
import {
  CMD_ACTIONS,
  CMD_CLASS,
  PIPELINE_STATES,
  STATE_EMOJI,
  STATE_LABELS,
  stateColor,
} from '@dashboard/frontend/lib/constants'
import { getNewIssueActions } from '@dashboard/frontend/lib/issue-helpers'
import { issues, runningId, selectedId } from '@dashboard/frontend/lib/state'
import type { Issue } from '@dashboard/frontend/lib/types'
import { basicSetup, EditorView } from 'codemirror'
import { marked } from 'marked'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { IssueState } from '@/types/schema/issue-schema'

type TabId = 'preview' | 'edit' | 'metadata'

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Strips inline event handlers and script elements from a parsed document
 * before any nodes are appended to the live DOM.
 */
function sanitizeDoc(doc: Document): void {
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    }
  }
  for (const script of Array.from(doc.body.querySelectorAll('script'))) {
    script.remove()
  }
}

/**
 * Safely renders an HTML string into a container by parsing it into a
 * disconnected document, stripping event handlers and scripts, then
 * appending the sanitized nodes.
 */
function safeRenderHTML(container: HTMLElement, htmlString: string): void {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')
  sanitizeDoc(doc)
  container.textContent = ''
  while (doc.body.firstChild) {
    container.appendChild(doc.body.firstChild)
  }
}

/**
 * Renders issue frontmatter (excluding body) as syntax-highlighted JSON.
 */
function renderMetadataJSON(issue: Issue): string {
  const { body, ...frontmatter } = issue
  const json = JSON.stringify(frontmatter, null, 2)
  const highlighted = json
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1":</span>')
    .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/: null/g, ': <span class="json-null">null</span>')
  return `<pre class="metadata-viewer">${highlighted}</pre>`
}

// ── RelChip sub-component ────────────────────────────────────────────────────

function RelChip({
  id,
  issue,
  onNavigate,
}: {
  id: string
  issue: Issue | undefined
  onNavigate: (id: string) => void
}) {
  return (
    <button
      type="button"
      className="btn btn-xs btn-ghost border border-neutral gap-[0.3125rem]"
      onClick={() => onNavigate(id)}
    >
      {issue && (
        <span
          className="w-sm h-sm rounded-full shrink-0"
          style={{ background: stateColor(issue.state) }}
        />
      )}
      <span className="text-base-content/50 text-xs">#{id}</span>
      {issue && (
        <span>
          {issue.title.length > 28
            ? `${issue.title.slice(0, 28)}\u2026`
            : issue.title}
        </span>
      )}
    </button>
  )
}

// ── IssueSteps sub-component ─────────────────────────────────────────────────

/**
 * Horizontal DaisyUI Steps showing issue progress through the linear pipeline.
 * Side-states (STUCK/SPLIT) show all steps as neutral since they're off the happy path.
 */
function IssueSteps({ state }: { state: string }) {
  const currentIdx = PIPELINE_STATES.indexOf(state as IssueState)

  return (
    <ul className="steps steps-horizontal w-full p-sm border-b border-neutral shrink-0 text-xs">
      {PIPELINE_STATES.map((s, i) => {
        const reached = currentIdx >= 0 && i <= currentIdx
        return (
          <li
            key={s}
            className={`step${reached ? ' step-secondary' : ''}`}
            // style={
            //   reached
            //     ? ({ '--step-color': stateColor(s) } as React.CSSProperties)
            //     : undefined
            // }
            data-content={STATE_EMOJI[s]}
          >
            {STATE_LABELS[s]}
          </li>
        )
      })}
    </ul>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function EditorSidebar() {
  const id = selectedId.value
  const allIssues = issues.value
  const running = runningId.value

  const issue = id ? allIssues.find((i) => i.id === id) : undefined

  const [activeTab, setActiveTab] = useState<TabId>('preview')
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  const previewRef = useRef<HTMLDivElement>(null)
  const cmContainerRef = useRef<HTMLDivElement>(null)
  const metadataRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const bodyRef = useRef<string>('')

  // Reset state when issue changes
  useEffect(() => {
    setActiveTab('preview')
    setDirty(false)
    setSaveStatus('')
    bodyRef.current = issue?.body ?? ''

    // Destroy existing CodeMirror
    if (editorViewRef.current) {
      editorViewRef.current.destroy()
      editorViewRef.current = null
    }
  }, [issue?.body])

  // Toggle sidebar grid layout on #app
  useEffect(() => {
    const app = document.getElementById('app')
    if (!app) return
    if (id === null) {
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
  }, [])

  // Render preview HTML
  useEffect(() => {
    if (activeTab !== 'preview' || !previewRef.current) return
    const content = editorViewRef.current
      ? editorViewRef.current.state.doc.toString()
      : bodyRef.current
    const htmlString = marked.parse(content) as string
    safeRenderHTML(previewRef.current, htmlString)
  }, [activeTab])

  // Mount CodeMirror lazily when Edit tab is selected
  useEffect(() => {
    if (activeTab !== 'edit' || !cmContainerRef.current) return
    if (editorViewRef.current) return // already mounted

    const parent = cmContainerRef.current
    parent.textContent = ''

    const state = EditorState.create({
      doc: bodyRef.current,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setDirty(true)
            setSaveStatus('unsaved')
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '0.75rem' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': { fontFamily: "'SF Mono', 'Fira Code', monospace" },
        }),
      ],
    })

    editorViewRef.current = new EditorView({ state, parent })

    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy()
        editorViewRef.current = null
      }
    }
  }, [activeTab])

  // Render metadata HTML
  useEffect(() => {
    if (activeTab !== 'metadata' || !metadataRef.current || !issue) return
    const htmlString = renderMetadataJSON(issue)
    safeRenderHTML(metadataRef.current, htmlString)
  }, [activeTab, issue])

  // Save handler
  const handleSave = useCallback(async () => {
    if (!id) return
    const body = editorViewRef.current
      ? editorViewRef.current.state.doc.toString()
      : bodyRef.current
    try {
      setSaveStatus('saving...')
      await api.updateIssue(id, { body })
      setDirty(false)
      setSaveStatus('saved')
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? '' : prev))
      }, 2000)
    } catch (e) {
      setSaveStatus(
        `save failed: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }, [])

  // Close handler
  const handleClose = useCallback(() => {
    selectedId.value = null
  }, [])

  if (!id || !issue) return null

  // const color = stateColor(issue.state)
  // const transitions = VALID_TRANSITIONS[issue.state as IssueState] ?? []
  const hasParent = !!issue.parent?.trim()
  const hasChildren = issue.children && issue.children.length > 0
  const isRunningThis = running === issue.id
  const actions =
    issue.state === 'NEW'
      ? getNewIssueActions(issue)
      : (CMD_ACTIONS[issue.state as IssueState] ?? [])

  return (
    <div
      id="sidebar"
      className="relative flex flex-col h-full bg-base-200 border-l border-neutral min-w-[30vw] overflow-hidden"
      style={{ gridArea: 'sidebar' }}
    >
      {/* Header */}
      <div className="flex items-center gap-md px-2xl py-lg border-b border-neutral shrink-0">
        <span className="text-md text-base-content/50">#{issue.id}</span>
        <span className="text-lg font-bold flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {issue.title}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          onClick={handleClose}
          aria-label="Close sidebar"
        >
          &times;
        </button>
      </div>

      {/* State row */}
      <div className="px-2xl py-md border-b border-neutral flex items-center gap-md flex-wrap shrink-0">
        <span
          className="badge badge-soft font-bold tracking-[0.06em]"
          // style={{ color, borderColor: color }}
        >
          {STATE_EMOJI[issue.state as IssueState]}{' '}
          {STATE_LABELS[issue.state as IssueState] ?? issue.state}
        </span>
        {/* <span className="flex gap-sm flex-wrap">
          {transitions.map((to) => (
            <button
              type="button"
              className="btn btn-xs btn-ghost border border-neutral"
              key={to}
              onClick={() => doTransition(issue.id, to)}
            >
              {'\u2192'} {STATE_LABELS[to] ?? to}
            </button>
          ))}
        </span> */}
      </div>

      {/* Relationships */}
      {(hasParent || hasChildren) && (
        <div className="px-2xl py-md border-b border-neutral shrink-0 flex flex-col gap-sm">
          {hasParent && (
            <div className="flex items-center gap-sm flex-wrap">
              <span className="text-xs text-base-content/50 uppercase tracking-[0.06em] whitespace-nowrap min-w-[3.25rem]">
                parent
              </span>
              <RelChip
                id={issue.parent ?? ''}
                issue={allIssues.find((i) => i.id === issue.parent)}
                onNavigate={navigateToIssue}
              />
            </div>
          )}
          {hasChildren && (
            <div className="flex items-center gap-sm flex-wrap">
              <span className="text-xs text-base-content/50 uppercase tracking-[0.06em] whitespace-nowrap min-w-[3.25rem]">
                children
              </span>
              {issue.children.map((childId: string) => (
                <RelChip
                  key={childId}
                  id={childId}
                  issue={allIssues.find((i) => i.id === childId)}
                  onNavigate={navigateToIssue}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs tabs-border shrink-0">
        {(['preview', 'edit', 'metadata'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            className={`tab tab-sm ${activeTab === tab ? 'tab-active' : ''}`}
            data-tab={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div
          id="editor-preview"
          ref={previewRef}
          className="flex-1 overflow-y-auto px-3xl py-2xl text-base leading-[1.7]"
          style={{ display: activeTab === 'preview' ? 'block' : 'none' }}
        />
        <div
          id="editor-cm"
          ref={cmContainerRef}
          className="flex-1 overflow-auto"
          style={{ display: activeTab === 'edit' ? '' : 'none' }}
        />
        <div
          id="editor-metadata"
          ref={metadataRef}
          className="h-full overflow-auto"
          style={{ display: activeTab === 'metadata' ? 'block' : 'none' }}
        />
      </div>
      {/* Progress steps */}
      <IssueSteps state={issue.state} />
      {/* Actions */}
      <div className="px-2xl py-lg border-t border-neutral flex gap-md flex-wrap shrink-0">
        {dirty && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
          >
            Save
          </button>
        )}

        {isRunningThis ? (
          <button
            type="button"
            className="btn btn-error"
            style={{ fontSize: '0.75rem', padding: '0.3125rem 0.875rem' }}
            onClick={stopAndReset}
          >
            {'\u25A0'} Stop
          </button>
        ) : (
          actions.map((cmd) => (
            <ActionButton
              key={cmd}
              label={`Run ${cmd}`}
              loadingLabel={`Running ${cmd}...`}
              className={`btn ${CMD_CLASS[cmd as keyof typeof CMD_CLASS] ?? ''}`}
              style={{ fontSize: '0.75rem', padding: '0.3125rem 0.875rem' }}
              loading="loading-ring"
              disabled={running !== null && cmd !== 'interview'}
              onClick={() => runCommand(issue.id, cmd)}
            />
          ))
        )}

        <ActionButton
          label="Delete"
          loadingLabel="Deleting..."
          className="btn btn-ghost btn-sm border border-neutral text-base-content/50"
          loading="loading-dots"
          onClick={() => {
            if (confirm(`Delete issue #${issue.id}?`)) deleteIssue(issue.id)
          }}
        />

        {saveStatus && (
          <span className="text-sm text-base-content/50 self-center ml-auto">
            {saveStatus}
          </span>
        )}
      </div>
    </div>
  )
}
