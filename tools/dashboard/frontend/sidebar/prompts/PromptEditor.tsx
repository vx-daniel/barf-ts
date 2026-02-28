/**
 * CodeMirror editor for prompt template editing with save support.
 */
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { basicSetup, EditorView } from 'codemirror'
import * as api from '@dashboard/frontend/common/utils/api-client'

interface PromptEditorProps {
  name: string
  content: string
  onSaved: (newContent: string) => void
}

export function PromptEditor({
  name,
  content,
  onSaved,
}: PromptEditorProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!containerRef.current) return

    const parent = containerRef.current
    parent.textContent = ''

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) setDirty(true)
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '0.75rem' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    })

    viewRef.current = new EditorView({ state, parent })
    setDirty(false)
    setStatus('')

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [content])

  const handleSave = async (): Promise<void> => {
    const text = viewRef.current?.state.doc.toString() ?? content
    try {
      setStatus('Saving...')
      await api.savePromptContent(name, text)
      setDirty(false)
      setStatus('Saved')
      onSaved(text)
      setTimeout(() => setStatus((s) => (s === 'Saved' ? '' : s)), 2000)
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box ref={containerRef} sx={{ flex: 1, overflow: 'hidden' }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          py: 0.5,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {dirty && (
          <Button
            size="small"
            variant="contained"
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        )}
        {status && (
          <Typography variant="caption" color="text.secondary">
            {status}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
