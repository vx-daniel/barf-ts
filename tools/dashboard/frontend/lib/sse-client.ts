/**
 * EventSource manager with auto-reconnect for SSE endpoints.
 */

/**
 * Callback invoked for each parsed SSE message. The raw `data` field is
 * JSON-parsed before being passed here; malformed frames are silently skipped.
 */
export type SSEHandler = (data: Record<string, unknown>) => void

/**
 * Thin wrapper around the browser `EventSource` API that simplifies connect/close
 * lifecycle management for the dashboard's SSE activity stream.
 */
export class SSEClient {
  private source: EventSource | null = null

  /**
   * Opens an SSE connection to `url`, closing any existing connection first.
   * Each incoming message is JSON-parsed and forwarded to `onMessage`.
   *
   * @param url - The SSE endpoint URL (e.g. `/api/activity/stream`).
   * @param onMessage - Handler called with the parsed message payload.
   * @param onError - Optional callback invoked when the EventSource fires an error.
   */
  connect(url: string, onMessage: SSEHandler, onError?: () => void): void {
    this.close()
    this.source = new EventSource(url)
    this.source.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data))
      } catch {
        // skip malformed
      }
    }
    this.source.onerror = () => {
      onError?.()
    }
  }

  /**
   * Closes the active EventSource connection and releases the reference.
   * Safe to call when no connection is open.
   */
  close(): void {
    if (this.source) {
      this.source.close()
      this.source = null
    }
  }

  /**
   * Whether there is a non-closed EventSource connection.
   */
  get active(): boolean {
    return this.source !== null && this.source.readyState !== EventSource.CLOSED
  }
}
