/**
 * React hook wrapping EventSource lifecycle.
 * Auto-closes on unmount or when url becomes null.
 */
import { useEffect, useRef, useCallback } from 'react'

type SSEHandler = (data: Record<string, unknown>) => void

interface UseSSEOptions {
  url: string | null
  onMessage: SSEHandler
  onError?: () => void
}

interface UseSSEReturn {
  close: () => void
}

export function useSSE({
  url,
  onMessage,
  onError,
}: UseSSEOptions): UseSSEReturn {
  const sourceRef = useRef<EventSource | null>(null)
  const onMessageRef = useRef(onMessage)
  const onErrorRef = useRef(onError)
  onMessageRef.current = onMessage
  onErrorRef.current = onError

  useEffect(() => {
    if (!url) {
      sourceRef.current?.close()
      sourceRef.current = null
      return
    }

    const source = new EventSource(url)
    sourceRef.current = source

    source.onmessage = (e) => {
      try {
        onMessageRef.current(JSON.parse(e.data))
      } catch {
        // skip malformed
      }
    }
    source.onerror = () => {
      onErrorRef.current?.()
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [url])

  const close = useCallback(() => {
    sourceRef.current?.close()
    sourceRef.current = null
  }, [])

  return { close }
}
