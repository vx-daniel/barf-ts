import { fetchIssues } from '@dashboard/frontend/lib/actions'
import * as api from '@dashboard/frontend/lib/api-client'
import { newIssueOpen } from '@dashboard/frontend/lib/state'
import { createPortal } from 'preact/compat'
import { useEffect, useRef } from 'preact/hooks'

/**
 * New-issue modal that reads the {@link newIssueOpen} signal to control visibility.
 * Resets form fields and auto-focuses the title input on open. Submits via
 * {@link api.createIssue} then refreshes the issue list.
 */
export function NewIssueModal(): preact.JSX.Element | null {
  const titleRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const isOpen = newIssueOpen.value

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (isOpen && !dlg.open) {
      dlg.showModal()
      const t = setTimeout(() => titleRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
    if (!isOpen && dlg.open) {
      dlg.close()
    }
  }, [])

  const close = (): void => {
    newIssueOpen.value = false
  }

  const submit = async (form: HTMLFormElement): Promise<void> => {
    const data = new FormData(form)
    const title = String(data.get('title') ?? '').trim()
    if (!title) return
    const body = String(data.get('body') ?? '').trim() || undefined
    await api.createIssue(title, body)
    newIssueOpen.value = false
    await fetchIssues()
  }

  return createPortal(
    <dialog ref={dialogRef} className="modal" onClose={close}>
      <div className="modal-box bg-base-200 border border-neutral max-w-md">
        <h3 className="text-lg font-bold mb-4">New Issue</h3>
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault()
            void submit(e.currentTarget as HTMLFormElement)
          }}
        >
          <input
            ref={titleRef}
            name="title"
            className="input input-bordered w-full mb-3 bg-base-100"
            type="text"
            placeholder="Title"
          />
          <textarea
            name="body"
            className="textarea textarea-bordered w-full mb-3 bg-base-100"
            placeholder="Body (optional)"
          />
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>,
    document.body,
  )
}
