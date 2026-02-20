import {
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  type CliRenderer
} from '@opentui/core'
import type { Issue } from '@/types'
import { _APP_COLORS } from '@/tui/colors'

/** Maps an issue state to a compact colored prefix string. */
function stateIndicator(state: Issue['state']): { prefix: string; color: string } {
  switch (state) {
    case 'NEW':
      return { prefix: '○', color: _APP_COLORS.dim }
    case 'INTERVIEWING':
      return { prefix: '◑', color: _APP_COLORS.yellow }
    case 'PLANNED':
      return { prefix: '◎', color: _APP_COLORS.orange }
    case 'IN_PROGRESS':
      return { prefix: '●', color: _APP_COLORS.green }
    case 'STUCK':
      return { prefix: '✖', color: _APP_COLORS.red }
    case 'SPLIT':
      return { prefix: '⊕', color: _APP_COLORS.subtitle }
    case 'COMPLETED':
      return { prefix: '✔', color: _APP_COLORS.green }
  }
}

/**
 * Left-sidebar issue list backed by a {@link SelectRenderable}.
 *
 * Calls `onSelectionChanged` whenever the user navigates (j/k/↑/↓) and
 * `onItemSelected` when the user presses Enter.
 */
export class IssueList {
  private readonly root: BoxRenderable
  private readonly header: TextRenderable
  private select: SelectRenderable | null = null
  private issues: Issue[] = []
  private readonly renderer: CliRenderer
  private readonly onSelectionChanged: (issue: Issue) => void
  private readonly onItemSelected: (issue: Issue) => void

  constructor(
    renderer: CliRenderer,
    onSelectionChanged: (issue: Issue) => void,
    onItemSelected: (issue: Issue) => void
  ) {
    this.renderer = renderer
    this.onSelectionChanged = onSelectionChanged
    this.onItemSelected = onItemSelected

    this.root = new BoxRenderable(renderer, {
      id: 'issue-list-root',
      width: '25%',
      height: '100%',
      flexDirection: 'column',
      border: true,
      borderStyle: 'single',
      borderColor: _APP_COLORS.border,
      backgroundColor: _APP_COLORS.sidebar
    })

    this.header = new TextRenderable(renderer, {
      id: 'issue-list-header',
      content: ' ISSUES',
      fg: _APP_COLORS.title,
      width: '100%'
    })

    this.root.add(this.header)
  }

  /**
   * Replaces the displayed issue list. Destroys the old {@link SelectRenderable}
   * and creates a fresh one so navigation resets cleanly.
   *
   * @param issues - Full list of issues to display.
   */
  setIssues(issues: Issue[]): void {
    this.issues = issues

    // Destroy and remove the old SelectRenderable if present
    if (this.select) {
      this.root.remove(this.select)
      this.select.destroy()
      this.select = null
    }

    this.header.content = ` ISSUES (${issues.length})`

    if (issues.length === 0) {
      return
    }

    const options = issues.map(issue => {
      const { prefix } = stateIndicator(issue.state)
      return {
        name: `${prefix} ${issue.id}  ${issue.title.slice(0, 20)}`,
        description: issue.state,
        value: issue.id
      }
    })

    this.select = new SelectRenderable(this.renderer, {
      id: 'issue-select',
      flexGrow: 1,
      options,
      selectedIndex: 0
    })

    this.select.on(SelectRenderableEvents.SELECTION_CHANGED, (index: number) => {
      const issue = this.issues[index]
      if (issue) {
        this.onSelectionChanged(issue)
      }
    })

    this.select.on(SelectRenderableEvents.ITEM_SELECTED, (index: number) => {
      const issue = this.issues[index]
      if (issue) {
        this.onItemSelected(issue)
      }
    })

    this.root.add(this.select)
  }

  /** Currently selected issue, or `null` if the list is empty. */
  get selectedIssue(): Issue | null {
    return this.issues[0] ?? null
  }

  /** Delegate keyboard input to the inner SelectRenderable. */
  focus(): void {
    this.select?.focus()
  }

  /** Remove focus from the inner SelectRenderable. */
  blur(): void {
    this.select?.blur()
  }

  /** The BoxRenderable to add to the layout tree. */
  get renderable(): BoxRenderable {
    return this.root
  }
}
