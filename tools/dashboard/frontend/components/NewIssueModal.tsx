import { fetchIssues } from '@dashboard/frontend/lib/actions'
import * as api from '@dashboard/frontend/lib/api-client'
import { newIssueOpen } from '@dashboard/frontend/lib/state'
import { useEffect, useRef, useState } from 'preact/hooks'

/**
 * New-issue modal that reads the {@link newIssueOpen} signal to control visibility.
 * Resets form fields and auto-focuses the title input on open. Submits via
 * {@link api.createIssue} then refreshes the issue list.
 */
export function NewIssueModal(): preact.JSX.Element | null {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  const isOpen = newIssueOpen.value

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setBody('')
      const t = setTimeout(() => titleRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  if (!isOpen) return null

  const close = (): void => {
    newIssueOpen.value = false
  }

  const submit = async (): Promise<void> => {
    if (!title.trim()) return
    await api.createIssue(title.trim(), body.trim() || undefined)
    newIssueOpen.value = false
    await fetchIssues()
  }

  const handleOverlayClick = (e: MouseEvent): void => {
    if (e.target === e.currentTarget) close()
  }

  const handleTitleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div
      id="modal-ov"
      className="open"
      role="dialog"
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          newIssueOpen.value = false
        }
      }}
    >
      <div id="modal">
        <h3>New Issue</h3>
        <input
          ref={titleRef}
          type="text"
          placeholder="Title"
          value={title}
          onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
          onKeyDown={handleTitleKeyDown}
        />
        <textarea
          placeholder="Body (optional)"
          value={body}
          onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
        />
        <div id="modal-btns">
          <button type="button" onClick={() => close()}>
            Cancel
          </button>
          <button type="button" onClick={() => void submit()}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
