import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  type CliRenderer
} from '@opentui/core'
import { _APP_COLORS } from '@/tui/colors'

/**
 * Absolutely-positioned modal overlay for collecting a single answer during an interview.
 *
 * Show a question via {@link ask}, which returns a Promise resolving to the user's answer
 * when they press Enter. If numbered options are provided, a choice in range resolves
 * to the option text instead of the raw input.
 *
 * The App is responsible for calling {@link submit} on Enter and wiring key capture
 * (so Escape does not destroy the renderer while the modal is open).
 */
export class AnswerModal {
  private readonly root: BoxRenderable
  private readonly questionText: TextRenderable
  private readonly hintText: TextRenderable
  private readonly input: InputRenderable
  private value = ''
  private _isOpen = false
  private pending: ((answer: string) => void) | null = null
  private pendingOptions: string[] | undefined

  constructor(renderer: CliRenderer) {
    this.root = new BoxRenderable(renderer, {
      id: 'answer-modal-root',
      position: 'absolute',
      top: '25%',
      left: '15%',
      width: '70%',
      height: 10,
      zIndex: 10,
      flexDirection: 'column',
      justifyContent: 'center',
      border: true,
      borderStyle: 'rounded',
      borderColor: _APP_COLORS.yellow,
      backgroundColor: _APP_COLORS.sidebar,
      padding: 1,
      gap: 1
    })
    this.root.visible = false

    const titleText = new TextRenderable(renderer, {
      id: 'answer-modal-title',
      content: 'Interview Question',
      fg: _APP_COLORS.yellow,
      width: '100%'
    })

    this.questionText = new TextRenderable(renderer, {
      id: 'answer-modal-question',
      content: '',
      fg: _APP_COLORS.white,
      width: '100%'
    })

    this.hintText = new TextRenderable(renderer, {
      id: 'answer-modal-hint',
      content: 'Enter to submit',
      fg: _APP_COLORS.dim,
      width: '100%'
    })

    this.input = new InputRenderable(renderer, {
      id: 'answer-modal-input',
      width: '100%',
      placeholder: 'Your answer...',
      value: '',
      backgroundColor: _APP_COLORS.background,
      textColor: _APP_COLORS.white,
      cursorColor: _APP_COLORS.yellow,
      focusedBackgroundColor: _APP_COLORS.background
    })

    this.input.on(InputRenderableEvents.CHANGE, (v: string) => {
      this.value = v
    })

    this.root.add(titleText)
    this.root.add(this.questionText)
    this.root.add(this.hintText)
    this.root.add(this.input)
  }

  /**
   * Displays the modal with the given question and returns a Promise that resolves
   * with the user's answer once they press Enter.
   *
   * If `options` are provided and the user types a number in range 1–N, the promise
   * resolves with the corresponding option string rather than the raw number.
   *
   * @param question - Question text to display.
   * @param options - Optional multiple-choice list. Index outside range falls back to raw input.
   * @param hint - Override the hint text shown below the question.
   * @returns Promise resolving to the user's answer string.
   */
  ask(question: string, options?: string[], hint?: string): Promise<string> {
    this.pendingOptions = options
    this.questionText.content = question
    this.hintText.content =
      hint ??
      (options ? `Type 1–${options.length} for choice, or free text · Enter` : 'Enter to submit')
    this.value = ''
    this.input.value = ''
    this._isOpen = true
    this.root.visible = true
    this.input.focus()
    return new Promise(resolve => {
      this.pending = resolve
    })
  }

  /**
   * Resolves the pending answer promise with the current input value.
   * Called by the App when Enter is pressed while the modal is open.
   *
   * If options were provided and the raw value is a valid choice number,
   * resolves with the option text instead.
   */
  submit(): void {
    const raw = this.value.trim()
    const options = this.pendingOptions
    let answer = raw

    if (options && options.length > 0) {
      const num = parseInt(raw, 10)
      if (num >= 1 && num <= options.length) {
        answer = options[num - 1]!
      }
    }

    if (this.pending) {
      this.pending(answer)
      this.pending = null
    }
    this._isOpen = false
    this.root.visible = false
    this.input.blur()
  }

  /** Whether the modal is currently collecting an answer. */
  get isOpen(): boolean {
    return this._isOpen
  }

  /** The BoxRenderable to add to the layout tree (as an overlay). */
  get renderable(): BoxRenderable {
    return this.root
  }
}
