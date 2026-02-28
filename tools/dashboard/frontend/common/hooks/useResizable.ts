/**
 * Drag-to-resize hook for panels.
 * Returns a ref for the resize handle and the current size.
 */
import { useState, useCallback, useRef, useEffect } from 'react'

interface UseResizableOptions {
  direction: 'horizontal' | 'vertical'
  initial: number
  min: number
  max: number
}

interface UseResizableReturn {
  size: number
  handleRef: React.RefObject<HTMLDivElement | null>
  setSize: (size: number) => void
}

export function useResizable({
  direction,
  initial,
  min,
  max,
}: UseResizableOptions): UseResizableReturn {
  const [size, setSize] = useState(initial)
  const handleRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)
  const startRef = useRef({ pos: 0, size: 0 })

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current) return
      const delta =
        direction === 'horizontal'
          ? startRef.current.pos - e.clientX
          : startRef.current.pos - e.clientY
      const newSize = Math.min(
        max,
        Math.max(min, startRef.current.size + delta),
      )
      setSize(newSize)
    },
    [direction, min, max],
  )

  const onMouseUp = useCallback(() => {
    draggingRef.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return

    const onMouseDown = (e: MouseEvent): void => {
      e.preventDefault()
      draggingRef.current = true
      startRef.current = {
        pos: direction === 'horizontal' ? e.clientX : e.clientY,
        size,
      }
      document.body.style.cursor =
        direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    }

    handle.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    return () => {
      handle.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [direction, size, onMouseMove, onMouseUp])

  return { size, handleRef, setSize }
}
