/**
 * Document-level keyboard shortcut hook.
 * Respects input focus — skips when user is typing in an input/textarea.
 */
import { useEffect, useRef } from 'react'

interface UseKeyboardShortcutOptions {
  key: string
  handler: () => void
  enabled?: boolean
  ctrl?: boolean
  meta?: boolean
}

export function useKeyboardShortcut({
  key,
  handler,
  enabled = true,
  ctrl = false,
  meta = false,
}: UseKeyboardShortcutOptions): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return

    const listener = (e: KeyboardEvent): void => {
      // Skip when focus is in an input element
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return

      if (e.key !== key) return
      if (ctrl && !e.ctrlKey) return
      if (meta && !e.metaKey) return

      e.preventDefault()
      handlerRef.current()
    }

    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [key, enabled, ctrl, meta])
}
