/**
 * Editor panel — CodeMirror 6 markdown editor + marked preview.
 * Mounted in the sidebar when an issue is selected.
 */

import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup, EditorView } from 'codemirror'
import { marked } from 'marked'
import * as api from '../lib/api-client'
import { getEl } from '../lib/dom'
import type { Issue } from '../lib/types'

let editorView: EditorView | null = null
let currentIssueId: string | null = null
let currentBody: string = ''
let _dirty = false

const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['GROOMED', 'STUCK'],
  GROOMED: ['PLANNED', 'STUCK', 'SPLIT'],
  PLANNED: ['IN_PROGRESS', 'STUCK', 'SPLIT'],
  IN_PROGRESS: ['COMPLETED', 'STUCK', 'SPLIT'],
  STUCK: ['PLANNED', 'NEW', 'GROOMED', 'SPLIT'],
  SPLIT: [],
  COMPLETED: ['VERIFIED'],
  VERIFIED: [],
}

const STATE_COLORS: Record<string, string> = {
  NEW: '#6b7280',
  GROOMED: '#3b82f6',
  PLANNED: '#f59e0b',
  IN_PROGRESS: '#f97316',
  COMPLETED: '#22c55e',
  VERIFIED: '#10b981',
  STUCK: '#ef4444',
  SPLIT: '#a855f7',
}

const STATE_LABELS: Record<string, string> = {
  NEW: 'NEW',
  GROOMED: 'GROOMED',
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN PROGRESS',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  STUCK: 'STUCK',
  SPLIT: 'SPLIT',
}

function el(tag: string, cls?: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  return e
}

/**
 * Safely renders an HTML string into a container by parsing it into a DOM
 * fragment first, avoiding direct innerHTML assignment on live elements.
 * Content originates from local issue files owned by the dashboard operator.
 */
function safeRenderHTML(container: HTMLElement, htmlString: string): void {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')
  container.textContent = ''
  while (doc.body.firstChild) {
    container.appendChild(doc.body.firstChild)
  }
}

/**
 * Renders issue frontmatter (excluding body) as syntax-highlighted JSON.
 * Uses regex-based syntax highlighting for keys, strings, numbers, booleans, and null.
 * Returns HTML string meant to be rendered via safeRenderHTML.
 */
function renderMetadataJSON(issue: Issue): string {
  // Extract frontmatter, exclude body field
  const { body, ...frontmatter } = issue

  // Pretty-print JSON with 2-space indentation
  const json = JSON.stringify(frontmatter, null, 2)

  // Apply syntax highlighting via regex replacements
  const highlighted = json
    // Keys: "fieldName":
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1":</span>')
    // String values: "value"
    .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
    // Numbers: 123
    .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
    // Booleans: true/false
    .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
    // Null values
    .replace(/: null/g, ': <span class="json-null">null</span>')

  return `<pre class="metadata-viewer">${highlighted}</pre>`
}

export interface EditorCallbacks {
  onTransition: (issueId: string, to: string) => void
  onDelete: (issueId: string) => void
  onRunCommand: (issueId: string, cmd: string) => void
  onStop: () => void
  onNavigate: (issueId: string) => void
  onClose: () => void
  getIssues: () => Issue[]
  runningId: string | null
}

let callbacks: EditorCallbacks | null = null

export function initEditor(cb: EditorCallbacks): void {
  callbacks = cb

  document.getElementById('editor-tabs')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.classList.contains('editor-tab')) return
    const tab = target.dataset.tab
    document.querySelectorAll('.editor-tab').forEach((t) => {
      t.classList.remove('active')
    })
    target.classList.add('active')

    const cm = getEl('editor-cm')
    const preview = getEl('editor-preview')
    const metadata = getEl('editor-metadata')

    if (tab === 'edit') {
      if (!editorView) mountCodeMirror(currentBody)
      cm.style.display = ''
      preview.style.display = 'none'
      metadata.style.display = 'none'
    } else if (tab === 'metadata') {
      cm.style.display = 'none'
      preview.style.display = 'none'
      metadata.style.display = 'block'
      // Render metadata using safe HTML rendering
      const issues = callbacks?.getIssues() ?? []
      const currentIssue = issues.find((i) => i.id === currentIssueId)
      if (currentIssue) {
        const htmlString = renderMetadataJSON(currentIssue)
        safeRenderHTML(metadata, htmlString)
      }
    } else {
      // Preview tab
      cm.style.display = 'none'
      preview.style.display = 'block'
      metadata.style.display = 'none'
      updatePreview()
    }
  })

  document.getElementById('editor-close')?.addEventListener('click', () => {
    closeSidebar()
  })
}

export function openIssue(issue: Issue): void {
  currentIssueId = issue.id
  _dirty = false

  const app = getEl('app')
  app.classList.remove('no-sidebar')

  getEl('editor-id').textContent = `#${issue.id}`
  getEl('editor-title').textContent = issue.title

  const color = STATE_COLORS[issue.state] ?? '#6b7280'
  const stLbl = getEl('editor-state-lbl')
  stLbl.textContent = STATE_LABELS[issue.state] ?? issue.state
  stLbl.style.color = color
  stLbl.style.borderColor = color

  const transDiv = getEl('editor-trans')
  transDiv.textContent = ''
  for (const to of VALID_TRANSITIONS[issue.state] ?? []) {
    const btn = el('button', 'tbtn')
    btn.textContent = `\u2192 ${STATE_LABELS[to] ?? to}`
    btn.addEventListener('click', () => callbacks?.onTransition(issue.id, to))
    transDiv.appendChild(btn)
  }

  // Relationships
  const issues = callbacks?.getIssues() ?? []
  const hasParent = issue.parent?.trim()
  const hasChildren = issue.children && issue.children.length > 0
  const relsEl = getEl('editor-rels')
  relsEl.style.display = hasParent || hasChildren ? 'flex' : 'none'

  const parentRow = getEl('editor-parent-row')
  parentRow.textContent = ''
  parentRow.style.display = 'none'
  if (hasParent) {
    const pLabel = el('span', 'rel-label')
    pLabel.textContent = 'parent'
    parentRow.appendChild(pLabel)
    const parentIssue = issues.find((i) => i.id === issue.parent)
    parentRow.appendChild(buildRelChip(issue.parent, parentIssue))
    parentRow.style.display = 'flex'
  }

  const childrenRow = getEl('editor-children-row')
  childrenRow.textContent = ''
  childrenRow.style.display = 'none'
  if (hasChildren) {
    const cLabel = el('span', 'rel-label')
    cLabel.textContent = 'children'
    childrenRow.appendChild(cLabel)
    for (const childId of issue.children) {
      const childIssue = issues.find((i) => i.id === childId)
      childrenRow.appendChild(buildRelChip(childId, childIssue))
    }
    childrenRow.style.display = 'flex'
  }

  currentBody = issue.body || ''

  // Don't mount CodeMirror yet — preview is the default view.
  // CodeMirror mounts lazily when Edit tab is clicked.
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
  getEl('editor-cm').textContent = ''

  // Actions
  const actsDiv = getEl('editor-actions')
  actsDiv.textContent = ''

  const saveBtn = el('button', 'mbtn primary') as HTMLButtonElement
  saveBtn.id = 'editor-save-btn'
  saveBtn.textContent = 'Save'
  saveBtn.style.display = 'none'
  saveBtn.addEventListener('click', () => saveIssue())
  actsDiv.appendChild(saveBtn)

  const isRunningThis = callbacks?.runningId === issue.id

  if (isRunningThis) {
    const stopBtn = el('button', 'abtn abtn-stop') as HTMLButtonElement
    stopBtn.style.cssText = 'font-size:12px;padding:5px 14px'
    stopBtn.textContent = '\u25A0 Stop'
    stopBtn.addEventListener('click', () => callbacks?.onStop())
    actsDiv.appendChild(stopBtn)
  } else {
    const CMD_ACTIONS: Record<string, string[]> = {
      GROOMED: ['plan'],
      PLANNED: ['plan', 'build'],
      IN_PROGRESS: ['build'],
      COMPLETED: ['audit'],
      STUCK: ['plan'],
    }
    const CMD_CLASS: Record<string, string> = {
      plan: 'abtn-plan',
      build: 'abtn-build',
      audit: 'abtn-audit',
      triage: 'abtn-triage',
      interview: 'abtn-interview',
    }

    // Dynamic actions for NEW issues based on triage state
    let actions: string[]
    if (issue.state === 'NEW') {
      if (issue.needs_interview === undefined) actions = ['triage']
      else if (issue.needs_interview === true) actions = ['interview']
      else actions = []
    } else {
      actions = CMD_ACTIONS[issue.state] ?? []
    }

    for (const cmd of actions) {
      const btn = el(
        'button',
        `abtn ${CMD_CLASS[cmd] ?? ''}`,
      ) as HTMLButtonElement
      btn.style.cssText = 'font-size:12px;padding:5px 14px'
      btn.textContent = `Run ${cmd}`
      btn.disabled = callbacks?.runningId !== null
      btn.addEventListener('click', () =>
        callbacks?.onRunCommand(issue.id, cmd),
      )
      actsDiv.appendChild(btn)
    }
  }

  const delBtn = el('button', 'abtn') as HTMLButtonElement
  delBtn.style.cssText =
    'font-size:12px;padding:5px 14px;border-color:#6b7280;color:#6b7280'
  delBtn.textContent = 'Delete'
  delBtn.addEventListener('click', () => {
    if (confirm(`Delete issue #${issue.id}?`)) callbacks?.onDelete(issue.id)
  })
  actsDiv.appendChild(delBtn)

  const statusSpan = el('span')
  statusSpan.id = 'editor-save-status'
  actsDiv.appendChild(statusSpan)

  // Default to preview tab
  // Default to preview tab
  document
    .querySelector('.editor-tab[data-tab="edit"]')
    ?.classList.remove('active')
  document
    .querySelector('.editor-tab[data-tab="metadata"]')
    ?.classList.remove('active')
  document
    .querySelector('.editor-tab[data-tab="preview"]')
    ?.classList.add('active')
  document.getElementById('editor-cm')?.style.display = 'none'
  document.getElementById('editor-preview')?.style.display = 'block'
  document.getElementById('editor-metadata')?.style.display = 'none'
  updatePreview()
}

function buildRelChip(id: string, issue?: Issue): HTMLElement {
  const chip = el('span', 'rel-chip')
  if (issue) {
    const dot = el('span', 'state-dot')
    dot.style.background = STATE_COLORS[issue.state] ?? '#6b7280'
    chip.appendChild(dot)
  }
  const idSpan = el('span', 'rel-id')
  idSpan.textContent = `#${id}`
  chip.appendChild(idSpan)
  if (issue) {
    const titleSpan = el('span')
    titleSpan.textContent =
      issue.title.length > 28
        ? `${issue.title.slice(0, 28)}\u2026`
        : issue.title
    chip.appendChild(titleSpan)
  }
  chip.addEventListener('click', () => callbacks?.onNavigate(id))
  return chip
}

function mountCodeMirror(content: string): void {
  const parent = getEl('editor-cm')
  parent.textContent = ''

  if (editorView) {
    editorView.destroy()
    editorView = null
  }

  const state = EditorState.create({
    doc: content,
    extensions: [
      basicSetup,
      markdown(),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          _dirty = true
          const saveBtn = document.getElementById('editor-save-btn')
          if (saveBtn) saveBtn.style.display = ''
          const status = document.getElementById('editor-save-status')
          if (status) status.textContent = 'unsaved'
        }
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '12px' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { fontFamily: "'SF Mono', 'Fira Code', monospace" },
      }),
    ],
  })

  editorView = new EditorView({ state, parent })
}

function updatePreview(): void {
  const preview = document.getElementById('editor-preview')
  if (!preview) return
  const content = editorView ? editorView.state.doc.toString() : currentBody
  const htmlString = marked.parse(content) as string
  safeRenderHTML(preview, htmlString)
}

async function saveIssue(): Promise<void> {
  if (!currentIssueId) return
  const body = editorView ? editorView.state.doc.toString() : currentBody
  const status = document.getElementById('editor-save-status')

  try {
    if (status) status.textContent = 'saving...'
    await api.updateIssue(currentIssueId, { body })
    _dirty = false
    const saveBtn = document.getElementById('editor-save-btn')
    if (saveBtn) saveBtn.style.display = 'none'
    if (status) status.textContent = 'saved'
    setTimeout(() => {
      if (status && status.textContent === 'saved') status.textContent = ''
    }, 2000)
  } catch (e) {
    if (status)
      status.textContent = `save failed: ${e instanceof Error ? e.message : String(e)}`
  }
}

export function closeSidebar(): void {
  currentIssueId = null
  const app = getEl('app')
  app.classList.add('no-sidebar')
  app.style.gridTemplateColumns = ''
  if (editorView) {
    editorView.destroy()
    editorView = null
  }
  callbacks?.onClose()
}

export function getCurrentIssueId(): string | null {
  return currentIssueId
}
