/**
 * WebSocket manager for interview sessions.
 */

export type WSHandler = (data: Record<string, unknown>) => void

export class WSClient {
  private ws: WebSocket | null = null

  connect(
    issueId: string,
    onMessage: WSHandler,
    onOpen?: () => void,
    onClose?: () => void,
  ): void {
    this.close()
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.ws = new WebSocket(
      `${proto}//${location.host}/api/issues/${issueId}/run/interview`,
    )
    this.ws.onopen = () => onOpen?.()
    this.ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data))
      } catch {
        // skip
      }
    }
    this.ws.onerror = () => {
      // error
    }
    this.ws.onclose = () => {
      this.ws = null
      onClose?.()
    }
  }

  send(message: string): void {
    this.ws?.send(message)
  }

  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  get active(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
