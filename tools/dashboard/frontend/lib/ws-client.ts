/**
 * WebSocket manager for interview sessions.
 */

/**
 * Callback invoked for each parsed WebSocket message received during an
 * interview session. The raw frame data is JSON-parsed before delivery;
 * malformed frames are silently skipped.
 */
export type WSHandler = (data: Record<string, unknown>) => void

/**
 * Thin wrapper around the browser `WebSocket` API that manages the lifecycle
 * of a single interview session connection. Only one connection is kept open
 * at a time — calling `connect` while already connected closes the prior socket.
 */
export class WSClient {
  private ws: WebSocket | null = null

  /**
   * Opens a WebSocket connection to the interview endpoint for `issueId`,
   * closing any existing connection first. Uses `wss:` when the page is served
   * over HTTPS, otherwise `ws:`.
   *
   * @param issueId - The issue whose interview endpoint to connect to.
   * @param onMessage - Handler called with each parsed server message.
   * @param onOpen - Optional callback fired when the connection is established.
   * @param onClose - Optional callback fired when the connection closes for any reason.
   */
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

  /**
   * Sends a raw string message over the active WebSocket connection.
   * No-ops if no connection is open.
   *
   * @param message - The raw string to send (typically JSON-serialised).
   */
  send(message: string): void {
    this.ws?.send(message)
  }

  /**
   * Closes the active WebSocket connection and releases the reference.
   * Safe to call when no connection is open.
   */
  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Whether there is an open (OPEN-state) WebSocket connection.
   */
  get active(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
