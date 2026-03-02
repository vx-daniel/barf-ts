/**
 * PromptsPanel — prompt template editor with preview, edit, and diff tabs.
 *
 * Allows selecting any of the 7 prompt templates, viewing the rendered
 * markdown, editing with CodeMirror (with `$VAR` highlighting), and
 * comparing custom overrides against built-in defaults.
 */

import { markdown } from '@codemirror/lang-markdown'
import { MergeView } from '@codemirror/merge'
import { EditorState, type Range } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'
import { MarkdownPreview } from '@dashboard/frontend/components/MarkdownPreview'
import * as api from '@dashboard/frontend/lib/api-client'
import type { PromptData } from '@dashboard/frontend/lib/api-client'
import { basicSetup } from 'codemirror'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

type PromptTab = 'preview' | 'edit' | 'diff'

// ── $VAR highlighting ────────────────────────────────────────────────────────

const varMark = Decoration.mark({ class: 'cm-prompt-var' })

function buildVarDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const re = /\$[A-Z_]+/g
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      decorations.push(varMark.range(from + match.index, from + match.index + match[0].length))
    }
  }
  return Decoration.set(decorations, true)
}

const varHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildVarDecorations(view)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildVarDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

// ── Main component ───────────────────────────────────────────────────────────

export function PromptsPanel({ onClose }: { onClose: () => void }) {
  const [modes, setModes] = useState<string[]>([])
  const [selectedMode, setSelectedMode] = useState<string>('')
  const [promptData, setPromptData] = useState<PromptData | null>(null)
  const [tab, setTab] = useState<PromptTab>('preview')
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  const cmContainerRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const diffContainerRef = useRef<HTMLDivElement>(null)
  const mergeViewRef = useRef<MergeView | null>(null)
  /** Persists unsaved editor content across tab switches. */
  const draftRef = useRef<string | null>(null)

  // Load prompt modes on mount
  useEffect(() => {
    api.fetchPromptModes().then((m) => {
      setModes(m)
      if (m.length > 0 && !selectedMode) setSelectedMode(m[0])
    }).catch(() => {})
  }, [])

  // Load prompt data when mode changes
  useEffect(() => {
    if (!selectedMode) return
    setPromptData(null)
    setDirty(false)
    setSaveStatus('')
    setTab('preview')

    if (editorViewRef.current) {
      editorViewRef.current.destroy()
      editorViewRef.current = null
    }
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy()
      mergeViewRef.current = null
    }
    draftRef.current = null

    api.fetchPrompt(selectedMode).then(setPromptData).catch(() => {})
  }, [selectedMode])

  // Mount CodeMirror for edit tab
  useEffect(() => {
    if (tab !== 'edit' || !cmContainerRef.current || !promptData) return
    if (editorViewRef.current) return

    const parent = cmContainerRef.current
    parent.textContent = ''

    const state = EditorState.create({
      doc: draftRef.current ?? promptData.active,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        varHighlightPlugin,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            draftRef.current = update.state.doc.toString()
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
  }, [tab, promptData])

  // Mount MergeView for diff tab
  useEffect(() => {
    if (tab !== 'diff' || !diffContainerRef.current || !promptData) return
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy()
      mergeViewRef.current = null
    }

    const parent = diffContainerRef.current
    parent.textContent = ''

    const sharedExtensions = [
      basicSetup,
      markdown(),
      oneDark,
      EditorState.readOnly.of(true),
      EditorView.theme({
        '&': { height: '100%', fontSize: '0.75rem' },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { fontFamily: "'SF Mono', 'Fira Code', monospace" },
      }),
    ]

    mergeViewRef.current = new MergeView({
      parent,
      a: {
        doc: promptData.builtin,
        extensions: sharedExtensions,
      },
      b: {
        doc: draftRef.current ?? promptData.custom ?? promptData.builtin,
        extensions: sharedExtensions,
      },
    })

    return () => {
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy()
        mergeViewRef.current = null
      }
    }
  }, [tab, promptData])

  // Save handler
  const handleSave = useCallback(async () => {
    if (!selectedMode) return
    const content = draftRef.current ?? promptData?.active ?? ''
    try {
      setSaveStatus('saving...')
      await api.savePrompt(selectedMode, content)
      draftRef.current = null
      setDirty(false)
      setSaveStatus('saved')
      const updated = await api.fetchPrompt(selectedMode)
      setPromptData(updated)
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? '' : prev))
      }, 2000)
    } catch (e) {
      setSaveStatus(`save failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [selectedMode, promptData])

  // Revert handler
  const handleRevert = useCallback(async () => {
    if (!selectedMode || !promptData?.custom) return
    try {
      setSaveStatus('reverting...')
      await api.deletePrompt(selectedMode)
      if (editorViewRef.current) {
        editorViewRef.current.destroy()
        editorViewRef.current = null
      }
      draftRef.current = null
      const updated = await api.fetchPrompt(selectedMode)
      setPromptData(updated)
      setDirty(false)
      setSaveStatus('reverted')
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'reverted' ? '' : prev))
      }, 2000)
    } catch (e) {
      setSaveStatus(`revert failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }, [selectedMode, promptData])

  // Discard unsaved edits — reset editor to server content
  const handleDiscard = useCallback(() => {
    if (!promptData) return
    draftRef.current = null
    if (editorViewRef.current) {
      editorViewRef.current.destroy()
      editorViewRef.current = null
    }
    setDirty(false)
    setSaveStatus('')
    // Force re-render by toggling promptData (triggers editor re-mount)
    setPromptData({ ...promptData })
  }, [promptData])

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-md px-2xl py-lg border-b border-neutral shrink-0">
        <span className="text-lg font-bold flex-1">Prompt Templates</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          &times;
        </button>
      </div>

      {/* Mode selector */}
      <div className="px-2xl py-md border-b border-neutral shrink-0 flex items-center gap-md">
        <select
          className="select select-sm select-bordered flex-1"
          value={selectedMode}
          onChange={(e) => setSelectedMode((e.target as HTMLSelectElement).value)}
        >
          {modes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        {promptData?.custom !== null && promptData?.custom !== undefined && (
          <span className="badge badge-sm badge-accent">customized</span>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="tabs tabs-border shrink-0">
        {(['preview', 'edit', 'diff'] as const).map((t) => (
          <button
            type="button"
            key={t}
            className={`tab tab-sm ${tab === t ? 'tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Preview tab */}
        <MarkdownPreview
          content={draftRef.current ?? promptData?.active ?? ''}
          visible={tab === 'preview'}
        />

        {/* Edit tab */}
        <div
          ref={cmContainerRef}
          className="flex-1 overflow-auto"
          style={{ display: tab === 'edit' ? '' : 'none' }}
        />

        {/* Diff tab — CodeMirror MergeView */}
        <div
          ref={diffContainerRef}
          className="flex-1 overflow-auto"
          style={{ display: tab === 'diff' ? '' : 'none' }}
        />
      </div>

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
        {dirty && (
          <button
            type="button"
            className="btn btn-ghost btn-sm border border-neutral text-warning"
            onClick={handleDiscard}
          >
            Discard
          </button>
        )}
        {promptData?.custom !== null && promptData?.custom !== undefined && (
          <button
            type="button"
            className="btn btn-ghost btn-sm border border-neutral text-base-content/50"
            onClick={handleRevert}
          >
            Revert to Default
          </button>
        )}
        {saveStatus && (
          <span className="text-sm text-base-content/50 self-center ml-auto">
            {saveStatus}
          </span>
        )}
      </div>
    </>
  )
}
