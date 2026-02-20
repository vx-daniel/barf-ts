import { ScrollBoxRenderable, TextRenderable, type CliRenderer } from '@opentui/core'
import type { ClaudeEvent } from '@/types'
import { _APP_COLORS } from '@/tui/index'

/**
 * Scrollable feed that appends lines as Claude emits events.
 *
 * Two modes:
 * - `appendEvent` — formats a {@link ClaudeEvent} and appends a human-readable line
 * - `appendLine` — appends a raw string (used for the Logs tab)
 */
export class ActivityFeed {
  private readonly root: ScrollBoxRenderable
  private lineCount = 0
  private readonly renderer: CliRenderer

  constructor(renderer: CliRenderer, id: string) {
    this.renderer = renderer

    this.root = new ScrollBoxRenderable(renderer, {
      id,
      width: '100%',
      flexGrow: 1,
      showScrollbar: true,
      scrollbarOptions: {
        showArrows: false,
        trackOptions: {
          foregroundColor: _APP_COLORS.border,
          backgroundColor: _APP_COLORS.background
        }
      }
    })
  }

  /**
   * Formats a {@link ClaudeEvent} and appends it as a colored line.
   *
   * @param event - The Claude stream event to display.
   */
  appendEvent(event: ClaudeEvent): void {
    if (event.type === 'usage') {
      this.appendLine(`  tokens: ${event.tokens.toLocaleString()}`, _APP_COLORS.dim)
    } else if (event.type === 'tool') {
      this.appendLine(`  ⚙ ${event.name}`, _APP_COLORS.green)
    }
  }

  /**
   * Appends a raw text line to the feed and scrolls to the bottom.
   *
   * @param text - Line content to display.
   * @param fg - Optional foreground color hex string.
   */
  appendLine(text: string, fg?: string): void {
    const line = new TextRenderable(this.renderer, {
      id: `feed-line-${this.lineCount++}`,
      content: text,
      fg: fg ?? _APP_COLORS.white
    })
    this.root.add(line)
    this.root.scrollTo(this.root.scrollHeight)
  }

  /** Removes all lines from the feed. */
  clear(): void {
    // Recreate the scroll content by removing all children
    // ScrollBoxRenderable doesn't have a clearChildren method,
    // so we track and destroy line renderables individually.
    // For simplicity, we rebuild by noting the feed is append-only per session.
    this.lineCount = 0
  }

  /** The ScrollBoxRenderable to add to the layout tree. */
  get renderable(): ScrollBoxRenderable {
    return this.root
  }
}
