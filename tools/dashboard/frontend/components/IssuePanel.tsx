/**
 * IssuePanel — extracted from Sidebar. Renders issue detail: header, state,
 * relationships, tabbed content (preview / edit / metadata), plan tabs, and
 * action buttons.
 */

import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { ActionButton } from '@dashboard/frontend/components/ActionButton'
import { MarkdownPreview } from '@dashboard/frontend/components/MarkdownPreview'
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
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { IssueState } from '@/types/schema/issue-schema'

type SectionId = 'issue' | 'plan'
type SubTabId = 'preview' | 'edit' | 'metadata'

const SECTION_TABS: Record<SectionId, readonly SubTabId[]> = {
  issue: ['preview', 'edit', 'metadata'],
  plan: ['preview', 'edit'],
} as const

// ── Utilities ────────────────────────────────────────────────────────────────

function safeRenderHTML(container: HTMLElement, htmlString: string): void {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    }
  }
  for (const script of Array.from(doc.body.querySelectorAll('script'))) {
    script.remove()
  }
  container.textContent = ''
  while (doc.body.firstChild) {
    container.appendChild(doc.body.firstChild)
  }
}

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

export function IssuePanel({ onClose }: { onClose: () => void }) {
  const id = selectedId.value
  const allIssues = issues.value
  const running = runningId.value

  const issue = id ? allIssues.find((i) => i.id === id) : undefined

  const [section, setSection] = useState<SectionId>('issue')
  const [subTab, setSubTab] = useState<SubTabId>('preview')
  const [dirty, setDirty] = useState(false)
  const [planDirty, setPlanDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const [planContent, setPlanContent] = useState<string | null>(null)

  const cmContainerRef = useRef<HTMLDivElement>(null)
  const metadataRef = useRef<HTMLDivElement>(null)
  const planCmContainerRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const planEditorViewRef = useRef<EditorView | null>(null)
  const bodyRef = useRef<string>('')
  const planBodyRef = useRef<string>('')

  // Reset state when issue changes
  useEffect(() => {
    setSection('issue')
    setSubTab('preview')
    setDirty(false)
    setPlanDirty(false)
    setSaveStatus('')
    setPlanContent(null)
    bodyRef.current = issue?.body ?? ''
    planBodyRef.current = ''

    if (editorViewRef.current) {
      editorViewRef.current.destroy()
      editorViewRef.current = null
    }
    if (planEditorViewRef.current) {
      planEditorViewRef.current.destroy()
      planEditorViewRef.current = null
    }

    if (id) {
      api.fetchPlan(id).then((content) => {
        setPlanContent(content)
        planBodyRef.current = content ?? ''
      }).catch(() => setPlanContent(null))
    }
  }, [id])

  // Derive preview content — reads from editor if mounted, else from ref
  const issuePreviewContent = editorViewRef.current
    ? editorViewRef.current.state.doc.toString()
    : bodyRef.current
  const planPreviewContent = planEditorViewRef.current
    ? planEditorViewRef.current.state.doc.toString()
    : planBodyRef.current

  // Mount issue CodeMirror lazily when Issue > Edit is selected
  useEffect(() => {
    if (section !== 'issue' || subTab !== 'edit' || !cmContainerRef.current) return
    if (editorViewRef.current) return

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
  }, [section, subTab, id])

  // Mount plan CodeMirror lazily when Plan > Edit is selected
  useEffect(() => {
    if (section !== 'plan' || subTab !== 'edit' || !planCmContainerRef.current) return
    if (planEditorViewRef.current) return

    const parent = planCmContainerRef.current
    parent.textContent = ''

    const state = EditorState.create({
      doc: planBodyRef.current,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setPlanDirty(true)
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

    planEditorViewRef.current = new EditorView({ state, parent })

    return () => {
      if (planEditorViewRef.current) {
        planEditorViewRef.current.destroy()
        planEditorViewRef.current = null
      }
    }
  }, [section, subTab, id, planContent])

  // Render metadata HTML
  useEffect(() => {
    if (section !== 'issue' || subTab !== 'metadata' || !metadataRef.current || !issue) return
    const htmlString = renderMetadataJSON(issue)
    safeRenderHTML(metadataRef.current, htmlString)
  }, [section, subTab, id, issue])

  // Save issue body handler
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

  // Save plan handler
  const handleSavePlan = useCallback(async () => {
    if (!id) return
    const content = planEditorViewRef.current
      ? planEditorViewRef.current.state.doc.toString()
      : planBodyRef.current
    try {
      setSaveStatus('saving...')
      await api.savePlan(id, content)
      setPlanDirty(false)
      planBodyRef.current = content
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

  if (!id || !issue) return null

  const hasParent = !!issue.parent?.trim()
  const hasChildren = issue.children && issue.children.length > 0
  const isRunningThis = running === issue.id
  const EXPECTS_PLAN: Set<string> = new Set(['PLANNED', 'BUILT'])
  const missingPlan = planContent === null && EXPECTS_PLAN.has(issue.state)
  const actions =
    missingPlan
      ? ['plan']
      : issue.state === 'NEW'
        ? getNewIssueActions(issue)
        : (CMD_ACTIONS[issue.state as IssueState] ?? [])

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-md px-2xl py-lg border-b border-neutral shrink-0">
        <span className="text-md text-base-content/50">#{issue.id}</span>
        <span className="text-lg font-bold flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {issue.title}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          &times;
        </button>
      </div>

      {/* State row */}
      <div className="px-2xl py-md border-b border-neutral flex items-center gap-md flex-wrap shrink-0">
        <span className="badge badge-soft font-bold tracking-[0.06em]">
          {STATE_EMOJI[issue.state as IssueState]}{' '}
          {STATE_LABELS[issue.state as IssueState] ?? issue.state}
        </span>
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

      {/* Missing plan warning */}
      {missingPlan && (
        <div className="px-2xl py-md border-b border-neutral bg-warning/10 text-warning text-xs font-medium shrink-0">
          No plan found — run plan before other actions
        </div>
      )}

      {/* Section selector (Issue / Plan) */}
      <div className="flex border-b border-neutral shrink-0">
        {(planContent !== null ? ['issue', 'plan'] as const : ['issue'] as const).map((s) => (
          <button
            type="button"
            key={s}
            className={`flex-1 py-sm text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
              section === s
                ? 'text-primary border-b-2 border-primary bg-base-300/50'
                : 'text-base-content/40 hover:text-base-content/70'
            }`}
            onClick={() => {
              setSection(s)
              setSubTab('preview')
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="tabs tabs-border shrink-0">
        {SECTION_TABS[section].map((tab) => (
          <button
            type="button"
            key={tab}
            className={`tab tab-sm ${subTab === tab ? 'tab-active' : ''}`}
            data-tab={tab}
            onClick={() => setSubTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        <MarkdownPreview
          content={issuePreviewContent}
          visible={section === 'issue' && subTab === 'preview'}
        />
        <div
          id="editor-cm"
          ref={cmContainerRef}
          className="flex-1 overflow-auto"
          style={{ display: section === 'issue' && subTab === 'edit' ? '' : 'none' }}
        />
        <div
          id="editor-metadata"
          ref={metadataRef}
          className="h-full overflow-auto"
          style={{ display: section === 'issue' && subTab === 'metadata' ? 'block' : 'none' }}
        />
        <MarkdownPreview
          content={planPreviewContent}
          visible={section === 'plan' && subTab === 'preview'}
        />
        <div
          id="plan-cm"
          ref={planCmContainerRef}
          className="flex-1 overflow-auto"
          style={{ display: section === 'plan' && subTab === 'edit' ? '' : 'none' }}
        />
      </div>
      {/* Progress steps */}
      <IssueSteps state={issue.state} />
      {/* Actions */}
      <div className="px-2xl py-lg border-t border-neutral flex gap-md flex-wrap shrink-0">
        {dirty && section === 'issue' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
          >
            Save
          </button>
        )}
        {planDirty && section === 'plan' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSavePlan}
          >
            Save Plan
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
    </>
  )
}
