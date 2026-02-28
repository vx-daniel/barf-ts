/**
 * Interval-based polling hook with enable/disable support.
 * Clears interval on unmount or when disabled.
 */
import { useEffect, useRef } from 'react'

interface UsePollingOptions {
  fn: () => void | Promise<void>
  interval: number
  enabled?: boolean
}

export function usePolling({
  fn,
  interval,
  enabled = true,
}: UsePollingOptions): void {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return

    const id = setInterval(() => {
      void fnRef.current()
    }, interval)

    return () => clearInterval(id)
  }, [interval, enabled])
}
