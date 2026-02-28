/**
 * React hook wrapping WebSocket lifecycle for interview sessions.
 * Auto-closes on unmount or when url becomes null.
 */
import { useEffect, useRef, useCallback } from 'react'

type WSHandler = (data: Record<string, unknown>) => void

interface UseWebSocketOptions {
  url: string | null
  onMessage: WSHandler
  onOpen?: () => void
  onClose?: () => void
}

interface UseWebSocketReturn {
  send: (message: string) => void
  close: () => void
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)
  onMessageRef.current = onMessage
  onOpenRef.current = onOpen
  onCloseRef.current = onClose

  useEffect(() => {
    if (!url) {
      wsRef.current?.close()
      wsRef.current = null
      return
    }

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => onOpenRef.current?.()
    ws.onmessage = (e) => {
      try {
        onMessageRef.current(JSON.parse(e.data))
      } catch {
        // skip malformed
      }
    }
    ws.onclose = () => {
      wsRef.current = null
      onCloseRef.current?.()
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [url])

  const send = useCallback((message: string) => {
    wsRef.current?.send(message)
  }, [])

  const close = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  return { send, close }
}
