import {
  BoxRenderable,
  TextRenderable,
  TabSelectRenderable,
  TabSelectRenderableEvents,
  ScrollBoxRenderable,
  MarkdownRenderable,
  type CliRenderer
} from '@opentui/core'
import type { Issue, ClaudeEvent } from '@/types'
import { ActivityFeed } from './activity-feed'
import { _APP_COLORS } from '@/tui/index'

type TabIndex = 0 | 1 | 2

/**
 * Main content panel with three tabs: Detail, Activity, Logs.
 *
 * - **Detail**: renders the issue body as markdown plus frontmatter summary
 * - **Activity**: live feed of {@link ClaudeEvent}s (tool calls, token counts)
 * - **Logs**: raw JSON log lines from the Claude stream
 */
export class DetailPanel {
  private readonly root: BoxRenderable
  private readonly tabBar: TabSelectRenderable
  private readonly contentArea: BoxRenderable

  // Tab wrapper boxes — one mounted at a time via add/remove
  private readonly detailWrapper: BoxRenderable
  private readonly activityWrapper: BoxRenderable
  private readonly logsWrapper: BoxRenderable

  // Tab content views
  private readonly detailScrollbox: ScrollBoxRenderable
  private detailMd: MarkdownRenderable | null = null
  private readonly detailSummary: TextRenderable
  private readonly activityFeed: ActivityFeed
  private readonly logsFeed: ActivityFeed

  private activeTab: TabIndex = 0
  private readonly renderer: CliRenderer

  constructor(renderer: CliRenderer) {
    this.renderer = renderer

    this.root = new BoxRenderable(renderer, {
      id: 'detail-panel',
      flexGrow: 1,
      height: '100%',
      flexDirection: 'column',
      backgroundColor: _APP_COLORS.background
    })

    // Tab bar
    this.tabBar = new TabSelectRenderable(renderer, {
      id: 'detail-tabs',
      width: '100%',
      options: [
        { name: ' Detail ', description: 'Issue body' },
        { name: ' Activity ', description: 'Claude events' },
        { name: ' Logs ', description: 'Raw stream' }
      ],
      tabWidth: 12
    })

    this.tabBar.on(TabSelectRenderableEvents.SELECTION_CHANGED, (index: number) => {
      this.switchTab(index as TabIndex)
    })
    this.tabBar.on(TabSelectRenderableEvents.ITEM_SELECTED, (index: number) => {
      this.switchTab(index as TabIndex)
    })

    // Content area — swaps one child at a time via add/remove
    this.contentArea = new BoxRenderable(renderer, {
      id: 'detail-content',
      flexGrow: 1,
      width: '100%',
      flexDirection: 'column'
    })

    // ── Detail tab wrapper ───────────────────────────────────────────────────
    this.detailWrapper = new BoxRenderable(renderer, {
      id: 'detail-wrapper',
      width: '100%',
      flexGrow: 1,
      flexDirection: 'column'
    })

    this.detailScrollbox = new ScrollBoxRenderable(renderer, {
      id: 'detail-scrollbox',
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

    this.detailSummary = new TextRenderable(renderer, {
      id: 'detail-summary',
      content: '',
      fg: _APP_COLORS.dim,
      width: '100%'
    })
    this.detailScrollbox.add(this.detailSummary)
    this.detailWrapper.add(this.detailScrollbox)

    // ── Activity tab wrapper ─────────────────────────────────────────────────
    this.activityWrapper = new BoxRenderable(renderer, {
      id: 'activity-wrapper',
      width: '100%',
      flexGrow: 1,
      flexDirection: 'column'
    })
    this.activityFeed = new ActivityFeed(renderer, 'activity-feed')
    this.activityWrapper.add(this.activityFeed.renderable)

    // ── Logs tab wrapper ─────────────────────────────────────────────────────
    this.logsWrapper = new BoxRenderable(renderer, {
      id: 'logs-wrapper',
      width: '100%',
      flexGrow: 1,
      flexDirection: 'column'
    })
    this.logsFeed = new ActivityFeed(renderer, 'logs-feed')
    this.logsWrapper.add(this.logsFeed.renderable)

    // Mount root structure — only Detail tab active initially
    this.root.add(this.tabBar)
    this.root.add(this.contentArea)
    this.contentArea.add(this.detailWrapper)
  }

  /**
   * Updates the Detail tab to show the given issue.
   * Rebuilds the {@link MarkdownRenderable} with the issue body.
   *
   * @param issue - Issue to display.
   */
  setIssue(issue: Issue): void {
    const childInfo = issue.children.length > 0 ? ` | Children: ${issue.children.join(', ')}` : ''
    this.detailSummary.content = `State: ${issue.state}${childInfo}\n`

    // Rebuild MarkdownRenderable with new content
    if (this.detailMd) {
      this.detailScrollbox.remove('detail-markdown')
      this.detailMd.destroy()
    }

    const mdContent = issue.body.trim() || '_No body_'
    this.detailMd = new MarkdownRenderable(this.renderer, {
      id: 'detail-markdown',
      content: mdContent,
      width: '100%'
    })
    this.detailScrollbox.add(this.detailMd)
  }

  /**
   * Appends a {@link ClaudeEvent} to the Activity tab feed.
   *
   * @param event - Claude stream event to display.
   */
  appendEvent(event: ClaudeEvent): void {
    this.activityFeed.appendEvent(event)
  }

  /**
   * Appends a raw log line to the Logs tab feed.
   *
   * @param line - Raw string to append.
   */
  appendLog(line: string): void {
    this.logsFeed.appendLine(line, _APP_COLORS.dim)
  }

  /**
   * Switches the visible content view to the given tab index.
   * Removes the current wrapper and adds the new one (so inactive tabs
   * take no layout space).
   *
   * @param index - `0` = Detail, `1` = Activity, `2` = Logs
   */
  switchTab(index: TabIndex): void {
    // Remove current tab's wrapper by ID
    const prevId = ['detail-wrapper', 'activity-wrapper', 'logs-wrapper'][this.activeTab]
    if (prevId) {
      this.contentArea.remove(prevId)
    }

    this.activeTab = index

    const wrappers: BoxRenderable[] = [this.detailWrapper, this.activityWrapper, this.logsWrapper]
    const next = wrappers[index]
    if (next) {
      this.contentArea.add(next)
    }
  }

  /** Focus the tab bar so `[`/`]` navigation works. */
  focus(): void {
    this.tabBar.focus()
  }

  /** Blur the tab bar. */
  blur(): void {
    this.tabBar.blur()
  }

  /** Go to the previous tab (wraps). */
  prevTab(): void {
    const next = ((this.activeTab - 1 + 3) % 3) as TabIndex
    this.switchTab(next)
  }

  /** Go to the next tab (wraps). */
  nextTab(): void {
    const next = ((this.activeTab + 1) % 3) as TabIndex
    this.switchTab(next)
  }

  /** The BoxRenderable to add to the layout tree. */
  get renderable(): BoxRenderable {
    return this.root
  }

  /** Access the activity feed directly for appending events. */
  get activity(): ActivityFeed {
    return this.activityFeed
  }

  /** Access the logs feed directly. */
  get logs(): ActivityFeed {
    return this.logsFeed
  }
}
