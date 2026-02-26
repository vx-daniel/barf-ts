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
import {
  deleteIssue,
  doTransition,
  navigateToIssue,
  runCommand,
  stopAndReset,
} from '@dashboard/frontend/lib/actions'
import * as api from '@dashboard/frontend/lib/api-client'
import {
  CMD_ACTIONS,
  CMD_CLASS,
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
import { VALID_TRANSITIONS } from '@/types/schema/issue-schema'

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
    <button type="button" className="rel-chip" onClick={() => onNavigate(id)}>
      {issue && (
        <span
          className="state-dot"
          style={{ background: stateColor(issue.state) }}
        />
      )}
      <span className="rel-id">#{id}</span>
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
  }, [id])

  // Toggle no-sidebar class on #app
  useEffect(() => {
    const app = document.getElementById('app')
    if (!app) return
    if (id === null) {
      app.classList.add('no-sidebar')
    } else {
      app.classList.remove('no-sidebar')
    }
  }, [id])

  // Render preview HTML
  useEffect(() => {
    if (activeTab !== 'preview' || !previewRef.current) return
    const content = editorViewRef.current
      ? editorViewRef.current.state.doc.toString()
      : bodyRef.current
    const htmlString = marked.parse(content) as string
    safeRenderHTML(previewRef.current, htmlString)
  }, [activeTab, id])

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
          '&': { height: '100%', fontSize: '12px' },
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
  }, [activeTab, id])

  // Render metadata HTML
  useEffect(() => {
    if (activeTab !== 'metadata' || !metadataRef.current || !issue) return
    const htmlString = renderMetadataJSON(issue)
    safeRenderHTML(metadataRef.current, htmlString)
  }, [activeTab, id, issue])

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
  }, [id])

  // Close handler
  const handleClose = useCallback(() => {
    selectedId.value = null
  }, [])

  if (!id || !issue) return null

  const color = stateColor(issue.state)
  const transitions = VALID_TRANSITIONS[issue.state as IssueState] ?? []
  const hasParent = !!issue.parent?.trim()
  const hasChildren = issue.children && issue.children.length > 0
  const isRunningThis = running === issue.id
  const actions =
    issue.state === 'NEW'
      ? getNewIssueActions(issue)
      : (CMD_ACTIONS[issue.state as IssueState] ?? [])

  return (
    <div id="sidebar" className="editor-panel">
      {/* Header */}
      <div id="editor-header">
        <span id="editor-id">#{issue.id}</span>
        <span id="editor-title">{issue.title}</span>
        <button
          type="button"
          id="editor-close"
          onClick={handleClose}
          aria-label="Close sidebar"
        >
          &times;
        </button>
      </div>

      {/* State row */}
      <div id="editor-state-row">
        <span id="editor-state-lbl" style={{ color, borderColor: color }}>
          {STATE_LABELS[issue.state as IssueState] ?? issue.state}
        </span>
        <span id="editor-trans">
          {transitions.map((to) => (
            <button
              type="button"
              className="tbtn"
              key={to}
              onClick={() => doTransition(issue.id, to)}
            >
              {'\u2192'} {STATE_LABELS[to] ?? to}
            </button>
          ))}
        </span>
      </div>

      {/* Relationships */}
      {(hasParent || hasChildren) && (
        <div id="editor-rels" style={{ display: 'flex' }}>
          {hasParent && (
            <div id="editor-parent-row" className="rel-row">
              <span className="rel-label">parent</span>
              <RelChip
                id={issue.parent ?? ''}
                issue={allIssues.find((i) => i.id === issue.parent)}
                onNavigate={navigateToIssue}
              />
            </div>
          )}
          {hasChildren && (
            <div id="editor-children-row" className="rel-row">
              <span className="rel-label">children</span>
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
      <div id="editor-tabs">
        {(['preview', 'edit', 'metadata'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            className={`editor-tab${activeTab === tab ? ' active' : ''}`}
            data-tab={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div id="editor-content">
        <div
          id="editor-preview"
          ref={previewRef}
          style={{ display: activeTab === 'preview' ? 'block' : 'none' }}
        />
        <div
          id="editor-cm"
          ref={cmContainerRef}
          style={{ display: activeTab === 'edit' ? '' : 'none' }}
        />
        <div
          id="editor-metadata"
          ref={metadataRef}
          style={{ display: activeTab === 'metadata' ? 'block' : 'none' }}
        />
      </div>

      {/* Actions */}
      <div id="editor-actions">
        {dirty && (
          <button
            type="button"
            id="editor-save-btn"
            className="mbtn primary"
            onClick={handleSave}
          >
            Save
          </button>
        )}

        {isRunningThis ? (
          <button
            type="button"
            className="abtn abtn-stop"
            style={{ fontSize: '12px', padding: '5px 14px' }}
            onClick={stopAndReset}
          >
            {'\u25A0'} Stop
          </button>
        ) : (
          actions.map((cmd) => (
            <button
              type="button"
              key={cmd}
              className={`abtn ${CMD_CLASS[cmd as keyof typeof CMD_CLASS] ?? ''}`}
              style={{ fontSize: '12px', padding: '5px 14px' }}
              disabled={running !== null}
              onClick={() => runCommand(issue.id, cmd)}
            >
              Run {cmd}
            </button>
          ))
        )}

        <button
          type="button"
          className="abtn"
          style={{
            fontSize: '12px',
            padding: '5px 14px',
            borderColor: '#6b7280',
            color: '#6b7280',
          }}
          onClick={() => {
            if (confirm(`Delete issue #${issue.id}?`)) deleteIssue(issue.id)
          }}
        >
          Delete
        </button>

        {saveStatus && <span id="editor-save-status">{saveStatus}</span>}
      </div>
    </div>
  )
}
