import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  type CliRenderer
} from '@opentui/core'
import { _APP_COLORS } from '@/tui/colors'

/**
 * Absolutely-positioned modal overlay for creating a new issue.
 *
 * Mount via {@link renderable} on the root or a shared overlay container.
 * Show/hide with {@link open} and {@link close}.
 *
 * `onSubmit` is called with the trimmed title when the user presses Enter.
 * `onCancel` is called when the user presses Escape.
 */
export class NewIssueModal {
  private readonly root: BoxRenderable
  private readonly input: InputRenderable
  private value = ''
  private _isOpen = false
  private readonly onSubmitFn: (title: string) => void
  private readonly onCancelFn: () => void

  constructor(renderer: CliRenderer, onSubmit: (title: string) => void, onCancel: () => void) {
    this.onSubmitFn = onSubmit
    this.onCancelFn = onCancel

    // Floating panel centered in the terminal — hidden until opened
    this.root = new BoxRenderable(renderer, {
      id: 'modal-root',
      position: 'absolute',
      top: '30%',
      left: '20%',
      width: '60%',
      height: 7,
      zIndex: 10,
      flexDirection: 'column',
      justifyContent: 'center',
      border: true,
      borderStyle: 'rounded',
      borderColor: _APP_COLORS.title,
      backgroundColor: _APP_COLORS.sidebar,
      padding: 1,
      gap: 1
    })
    this.root.visible = false

    const titleText = new TextRenderable(renderer, {
      id: 'modal-title',
      content: 'New Issue',
      fg: _APP_COLORS.title,
      width: '100%'
    })

    const hintText = new TextRenderable(renderer, {
      id: 'modal-hint',
      content: 'Enter to create · Esc to cancel',
      fg: _APP_COLORS.dim,
      width: '100%'
    })

    this.input = new InputRenderable(renderer, {
      id: 'modal-input',
      width: '100%',
      placeholder: 'Issue title...',
      value: '',
      backgroundColor: _APP_COLORS.background,
      textColor: _APP_COLORS.white,
      cursorColor: _APP_COLORS.title,
      focusedBackgroundColor: _APP_COLORS.background
    })

    this.input.on(InputRenderableEvents.CHANGE, (v: string) => {
      this.value = v
    })

    this.root.add(titleText)
    this.root.add(hintText)
    this.root.add(this.input)
  }

  /** Opens the modal and focuses the input field. */
  open(): void {
    this.value = ''
    this.input.value = ''
    this._isOpen = true
    this.root.visible = true
    this.input.focus()
  }

  /** Hides the modal and blurs the input. */
  close(): void {
    this._isOpen = false
    this.root.visible = false
    this.input.blur()
  }

  /**
   * Submits the modal: calls `onSubmit` if the title is non-empty.
   * Called by the App when Enter is pressed while the modal is open.
   */
  submit(): void {
    const title = this.value.trim()
    if (title) {
      this.onSubmitFn(title)
    }
  }

  /**
   * Cancels the modal without creating an issue.
   * Called by the App when Escape is pressed while the modal is open.
   */
  cancel(): void {
    this.onCancelFn()
  }

  /** Whether the modal is currently visible. */
  get isOpen(): boolean {
    return this._isOpen
  }

  /** The BoxRenderable to add to the layout tree (as an overlay). */
  get renderable(): BoxRenderable {
    return this.root
  }
}
