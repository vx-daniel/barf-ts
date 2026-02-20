import { BoxRenderable, TextRenderable, type CliRenderer } from '@opentui/core'
import { _APP_COLORS } from '@/tui/colors'

/** Hint text shown when no operation is running. */
const HINTS = '[a]uto [i]ntv [p]lan [b]uild [u]audit [n]ew [e]dit [x]kill [?]help [q]uit'

/**
 * Bottom status bar showing keybind hints and the currently running operation.
 *
 * Mount via {@link renderable} — add it as the last child of the app's column container.
 */
export class StatusLine {
  private readonly root: BoxRenderable
  private readonly leftText: TextRenderable
  private readonly rightText: TextRenderable

  constructor(renderer: CliRenderer) {
    this.root = new BoxRenderable(renderer, {
      id: 'status-line',
      width: '100%',
      height: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: _APP_COLORS.header,
      paddingLeft: 1,
      paddingRight: 1
    })

    this.leftText = new TextRenderable(renderer, {
      id: 'status-hints',
      content: HINTS,
      fg: _APP_COLORS.dim
    })

    this.rightText = new TextRenderable(renderer, {
      id: 'status-op',
      content: '',
      fg: _APP_COLORS.yellow
    })

    this.root.add(this.leftText)
    this.root.add(this.rightText)
  }

  /**
   * Updates the running-operation indicator on the right side of the bar.
   *
   * @param op - The active operation, or `null` when idle.
   */
  setRunningOp(op: { issueId: string; type: string } | null): void {
    if (op) {
      this.rightText.content = `⠿ ${op.type.toUpperCase()} #${op.issueId}`
    } else {
      this.rightText.content = ''
    }
  }

  /**
   * Flashes an error message in the left hint area for 4 seconds,
   * then restores the normal hint text.
   *
   * @param message - Short error description to display.
   */
  showError(message: string): void {
    this.leftText.fg = _APP_COLORS.red
    this.leftText.content = `✖ ${message}`
    setTimeout(() => {
      this.leftText.fg = _APP_COLORS.dim
      this.leftText.content = HINTS
    }, 4000)
  }

  /** The BoxRenderable to add to the layout tree. */
  get renderable(): BoxRenderable {
    return this.root
  }
}
