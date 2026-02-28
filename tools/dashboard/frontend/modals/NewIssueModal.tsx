/**
 * New-issue creation modal.
 *
 * Controlled by {@link useUIStore.newIssueOpen}. Auto-focuses the title field
 * on open. Submits via {@link api.createIssue} then refreshes the issue list
 * via {@link useIssueStore.fetchIssues} before closing.
 */
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import { useUIStore } from '@dashboard/frontend/store/useUIStore'
import { useIssueStore } from '@dashboard/frontend/store/useIssueStore'
import * as api from '@dashboard/frontend/common/utils/api-client'

/**
 * Modal dialog for creating a new issue.
 *
 * Visibility is driven entirely by the `newIssueOpen` flag in
 * {@link useUIStore}. Title is required; body is optional.
 *
 * @returns The MUI Dialog element (always mounted, visibility via `open` prop).
 */
export function NewIssueModal(): React.JSX.Element {
  const isOpen = useUIStore((s) => s.newIssueOpen)
  const closeNewIssue = useUIStore((s) => s.closeNewIssue)
  const fetchIssues = useIssueStore((s) => s.fetchIssues)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  // Reset fields and auto-focus title on open
  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setBody('')
      setSubmitting(false)
      // Delay focus to allow the dialog transition to complete
      const t = setTimeout(() => titleRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  function handleClose(): void {
    if (!submitting) closeNewIssue()
  }

  async function handleSubmit(): Promise<void> {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    setSubmitting(true)
    try {
      await api.createIssue(trimmedTitle, body.trim() || undefined)
      closeNewIssue()
      await fetchIssues()
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleSubmit()
    }
  }

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { backgroundColor: 'background.paper' },
      }}
    >
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, pb: 1 }}>
        New Issue
      </DialogTitle>

      <DialogContent
        sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <TextField
          inputRef={titleRef}
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting}
          size="small"
          fullWidth
          autoComplete="off"
          inputProps={{ 'aria-label': 'Issue title' }}
        />
        <TextField
          label="Body (optional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={submitting}
          size="small"
          fullWidth
          multiline
          rows={4}
          autoComplete="off"
          inputProps={{ 'aria-label': 'Issue body' }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button variant="text" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={submitting || !title.trim()}
        >
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
