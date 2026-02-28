/**
 * CodeMirror-backed editor for the issue body.
 *
 * The editor is lazily created when the Edit tab becomes active and destroyed
 * when either the component unmounts or the selected issue changes. Dirty state
 * is surfaced to the parent via `onDirtyChange` so the IssuePanel tab label
 * and the save button can react to unsaved changes.
 */
import type React from 'react'
import { useEffect, useRef, useCallback } from 'react'
import Box from '@mui/material/Box'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorState } from '@codemirror/state'
import type { Issue } from '@/types/schema/issue-schema'

interface IssueEditorProps {
  /** The issue being edited — switching issues tears down and re-creates the editor. */
  issue: Issue
  /** Called with `true` when the buffer diverges from the persisted body, `false` after save. */
  onDirtyChange: (dirty: boolean) => void
}

/**
 * Mounts a CodeMirror 6 editor with one-dark theme and markdown language support.
 *
 * The editor ref is exposed via `data-editor-id` so integration tests can
 * locate the container without relying on internal CodeMirror DOM structure.
 *
 * @param issue - The issue whose body is loaded into the editor.
 * @param onDirtyChange - Callback invoked whenever dirty state changes.
 * @returns The editor container element.
 */
export function IssueEditor({
  issue,
  onDirtyChange,
}: IssueEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const originalRef = useRef<string>(issue.body ?? '')

  const destroyEditor = useCallback(() => {
    viewRef.current?.destroy()
    viewRef.current = null
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return

    // Tear down existing editor when issue changes
    destroyEditor()

    const body = issue.body ?? ''
    originalRef.current = body
    onDirtyChange(false)

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const current = update.state.doc.toString()
        onDirtyChange(current !== originalRef.current)
      }
    })

    const state = EditorState.create({
      doc: body,
      extensions: [basicSetup, oneDark, markdown(), updateListener],
    })

    viewRef.current = new EditorView({ state, parent: container })

    return () => {
      destroyEditor()
    }
  }, [destroyEditor, issue.body, onDirtyChange]) // eslint-disable-line react-hooks/exhaustive-deps
  // onDirtyChange intentionally omitted — it is stable from the parent

  return (
    <Box
      ref={containerRef}
      data-editor-id={issue.id}
      sx={{
        flex: 1,
        overflow: 'auto',
        height: '100%',
        '& .cm-editor': {
          height: '100%',
          fontSize: '0.8125rem',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        },
        '& .cm-scroller': { overflow: 'auto' },
        '& .cm-focused': { outline: 'none' },
      }}
    />
  )
}

/**
 * Returns the current editor content for a mounted {@link IssueEditor}.
 * Intended for use by {@link IssueActions} save handler which needs to read the buffer.
 *
 * @param editorId - The `data-editor-id` attribute value (issue.id).
 * @returns The editor document string, or null if no editor is mounted for that id.
 */
export function readEditorContent(editorId: string): string | null {
  const container = document.querySelector<HTMLElement>(
    `[data-editor-id="${editorId}"]`,
  )
  if (container === null) return null
  // Access the CodeMirror view instance stored on the DOM node by CM6 internals
  const cmKey = Object.keys(container).find((k) => k.startsWith('_cm'))
  if (cmKey === undefined) return null
  // @ts-expect-error — CM6 attaches the view to the DOM element under a symbol key
  const view = container[cmKey] as EditorView | undefined
  return view?.state.doc.toString() ?? null
}
