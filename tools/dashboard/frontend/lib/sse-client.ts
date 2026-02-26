/**
 * EventSource manager with auto-reconnect for SSE endpoints.
 */

export type SSEHandler = (data: Record<string, unknown>) => void

export class SSEClient {
  private source: EventSource | null = null

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

  close(): void {
    if (this.source) {
      this.source.close()
      this.source = null
    }
  }

  get active(): boolean {
    return this.source !== null && this.source.readyState !== EventSource.CLOSED
  }
}
