import { BoxRenderable, type CliRenderer, type KeyEvent } from '@opentui/core'
import { execFileSync } from 'child_process'
import { join } from 'path'
import type { Config, Issue, ClaudeEvent } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { runLoop } from '@/core/batch'
import { interviewLoop } from '@/core/interview'
import { createLogger } from '@/utils/logger'
import { _APP_COLORS } from '@/tui/colors'
import { IssueList } from './components/issue-list'
import { DetailPanel } from './components/detail-panel'
import { StatusLine } from './components/status-line'
import { NewIssueModal } from './components/new-issue-modal'
import { AnswerModal } from './components/answer-modal'

const logger = createLogger('tui')

/** Which panel currently receives keyboard focus. */
type FocusZone = 'list' | 'content'

/** A running barf operation with its abort controller. */
interface RunningOp {
  issueId: string
  type: string
  abort: AbortController
}

/**
 * Root application class for the barf TUI.
 *
 * Owns all state, wires keyboard input, mounts the layout tree, and
 * dispatches barf core operations in the background.
 *
 * @example
 * ```typescript
 * const app = new App(renderer, config, provider)
 * app.mount()
 * await app.refresh()
 * ```
 */
export class App {
  private readonly renderer: CliRenderer
  private readonly config: Config
  private readonly provider: IssueProvider

  // ── State ─────────────────────────────────────────────────────────────────
  private issues: Issue[] = []
  private selectedIssue: Issue | null = null
  private focusZone: FocusZone = 'list'
  private runningOp: RunningOp | null = null
  private showHelp = false

  // ── Components ────────────────────────────────────────────────────────────
  private issueList!: IssueList
  private detailPanel!: DetailPanel
  private statusLine!: StatusLine
  private modal!: NewIssueModal
  private answerModal!: AnswerModal

  constructor(renderer: CliRenderer, config: Config, provider: IssueProvider) {
    this.renderer = renderer
    this.config = config
    this.provider = provider
  }

  /**
   * Builds the layout tree and registers the keyboard handler.
   * Call once after constructing the App.
   */
  mount(): void {
    this.buildLayout()
    this.renderer.keyInput.on('keypress', (key: KeyEvent) => this.handleKey(key))
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  private buildLayout(): void {
    // Root column container
    const appRoot = new BoxRenderable(this.renderer, {
      id: 'app-root',
      width: '100%',
      height: '100%',
      flexDirection: 'column'
    })

    // Content row: sidebar + main panel
    const contentRow = new BoxRenderable(this.renderer, {
      id: 'content-row',
      width: '100%',
      flexGrow: 1,
      flexDirection: 'row'
    })

    // Issue list (left sidebar)
    this.issueList = new IssueList(
      this.renderer,
      issue => this.onIssuePreview(issue),
      issue => this.onIssueSelected(issue)
    )

    // Detail panel (right main area)
    this.detailPanel = new DetailPanel(this.renderer)

    // Status line (bottom bar)
    this.statusLine = new StatusLine(this.renderer)

    // New issue modal (absolute overlay on app root)
    this.modal = new NewIssueModal(
      this.renderer,
      title => this.createIssue(title),
      () => this.closeModal()
    )

    // Interview answer modal (absolute overlay on app root)
    this.answerModal = new AnswerModal(this.renderer)

    contentRow.add(this.issueList.renderable)
    contentRow.add(this.detailPanel.renderable)

    appRoot.add(contentRow)
    appRoot.add(this.statusLine.renderable)
    appRoot.add(this.modal.renderable)
    appRoot.add(this.answerModal.renderable)

    this.renderer.root.add(appRoot)

    // Start with list focused
    this.issueList.focus()
  }

  // ── Issue list events ──────────────────────────────────────────────────────

  private onIssuePreview(issue: Issue): void {
    this.selectedIssue = issue
    this.detailPanel.setIssue(issue)
  }

  private onIssueSelected(issue: Issue): void {
    this.selectedIssue = issue
    this.detailPanel.setIssue(issue)
    // Pressing Enter moves focus to content panel
    this.setFocusZone('content')
  }

  // ── Keyboard handler ───────────────────────────────────────────────────────

  private handleKey(key: KeyEvent): void {
    // Only handle press events, not repeat/release
    if (key.eventType !== 'press' && key.eventType !== 'repeat') {
      return
    }

    // Answer modal captures all keys when collecting an interview answer
    if (this.answerModal.isOpen) {
      this.handleAnswerModalKey(key)
      return
    }

    // New-issue modal captures all keys when open
    if (this.modal.isOpen) {
      this.handleModalKey(key)
      return
    }

    switch (key.name) {
      case 'q':
      case 'escape':
        this.renderer.destroy()
        return

      case 'tab':
        this.toggleFocusZone()
        return

      case '[':
        if (this.focusZone === 'content') {
          this.detailPanel.prevTab()
        }
        return

      case ']':
        if (this.focusZone === 'content') {
          this.detailPanel.nextTab()
        }
        return

      case 'r':
        this.refresh().catch(e => logger.error({ err: e }, 'refresh failed'))
        return

      case 'n':
        this.openModal()
        return

      case '?':
        this.showHelp = !this.showHelp
        return

      case 'e':
        this.openEditor()
        return

      case 'x':
        this.killRunningOp()
        return
    }

    // Action keys — only when no op is running
    if (!this.runningOp && this.selectedIssue) {
      switch (key.name) {
        case 'a':
          this.runOp('auto', () => this.runAuto())
          return
        case 'i':
          this.runOp('interview', () => this.runInterview())
          return
        case 'p':
          this.runOp('plan', () => this.runPlan())
          return
        case 'b':
          this.runOp('build', () => this.runBuild())
          return
        case 'u':
          this.runOp('audit', () => this.runAudit())
          return
      }
    }
  }

  private handleModalKey(key: KeyEvent): void {
    if (key.name === 'enter' || key.name === 'return') {
      this.modal.submit()
      this.closeModal()
    } else if (key.name === 'escape') {
      this.modal.cancel()
      this.closeModal()
    }
    // All other keys handled by the focused InputRenderable
  }

  private handleAnswerModalKey(key: KeyEvent): void {
    if (key.name === 'enter' || key.name === 'return') {
      this.answerModal.submit()
    }
    // Escape is swallowed — use 'x' to kill the interview op if needed.
    // All other keys flow to the focused InputRenderable for typing.
  }

  // ── Focus management ───────────────────────────────────────────────────────

  private setFocusZone(zone: FocusZone): void {
    this.focusZone = zone
    if (zone === 'list') {
      this.detailPanel.blur()
      this.issueList.focus()
    } else {
      this.issueList.blur()
      this.detailPanel.focus()
    }
  }

  private toggleFocusZone(): void {
    this.setFocusZone(this.focusZone === 'list' ? 'content' : 'list')
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  private openModal(): void {
    this.issueList.blur()
    this.detailPanel.blur()
    this.modal.open()
  }

  private closeModal(): void {
    this.modal.close()
    this.setFocusZone(this.focusZone)
  }

  // ── Operations ─────────────────────────────────────────────────────────────

  /** Starts a named operation and tracks it as the running op. */
  private runOp(type: string, fn: () => Promise<void>): void {
    if (this.runningOp || !this.selectedIssue) {
      return
    }

    const abort = new AbortController()
    this.runningOp = { issueId: this.selectedIssue.id, type, abort }
    this.statusLine.setRunningOp(this.runningOp)

    fn()
      .catch(e => {
        const msg = e instanceof Error ? e.message : String(e)
        this.detailPanel.activity.appendLine(`ERROR: ${msg}`, '#f7768e')
        this.statusLine.showError(msg)
        logger.error({ err: e, type }, 'operation failed')
      })
      .finally(() => {
        this.runningOp = null
        this.statusLine.setRunningOp(null)
        this.refresh().catch(e => logger.error({ err: e }, 'post-op refresh failed'))
      })
  }

  private makeEventHandler(): (event: ClaudeEvent) => void {
    return (event: ClaudeEvent) => {
      this.detailPanel.appendEvent(event)
      if (event.type === 'tool') {
        this.detailPanel.appendLog(JSON.stringify(event))
      }
    }
  }

  private async runPlan(): Promise<void> {
    if (!this.selectedIssue || !this.runningOp) {
      return
    }
    const result = await runLoop(this.selectedIssue.id, 'plan', this.config, this.provider, {
      onEvent: this.makeEventHandler(),
      signal: this.runningOp.abort.signal
    })
    if (result.isErr()) {
      throw result.error
    }
  }

  private async runBuild(): Promise<void> {
    if (!this.selectedIssue || !this.runningOp) {
      return
    }
    const result = await runLoop(this.selectedIssue.id, 'build', this.config, this.provider, {
      onEvent: this.makeEventHandler(),
      signal: this.runningOp.abort.signal
    })
    if (result.isErr()) {
      throw result.error
    }
  }

  private async runInterview(): Promise<void> {
    if (!this.selectedIssue || !this.runningOp) {
      return
    }
    this.detailPanel.showActivity()

    const issueId = this.selectedIssue.id

    // NEW → INTERVIEWING (skip if already INTERVIEWING — resume an interrupted session)
    if (this.selectedIssue.state === 'NEW') {
      const startResult = await this.provider.transition(issueId, 'INTERVIEWING')
      if (startResult.isErr()) {
        throw startResult.error
      }
    }

    const result = await interviewLoop(
      issueId,
      this.config,
      this.provider,
      this.makeEventHandler(),
      this.runningOp.abort.signal,
      (question, options) => this.promptUser(question, options)
    )
    if (result.isErr()) {
      throw result.error
    }

    // INTERVIEWING → PLANNED
    const endResult = await this.provider.transition(issueId, 'PLANNED')
    if (endResult.isErr()) {
      throw endResult.error
    }
  }

  /**
   * Collects a single interview answer via the TUI answer modal.
   * Appends the question and answer to the activity feed for the session record.
   *
   * @param question - Question text to display.
   * @param options - Optional choice list; selecting 1–N resolves to the option text.
   * @returns Promise resolving to the user's answer string.
   */
  private async promptUser(question: string, options?: string[]): Promise<string> {
    this.detailPanel.activity.appendLine(`Q: ${question}`, _APP_COLORS.yellow)
    if (options) {
      options.forEach((opt, i) => {
        this.detailPanel.activity.appendLine(`  ${i + 1}. ${opt}`, _APP_COLORS.dim)
      })
    }
    const answer = await this.answerModal.ask(question, options)
    this.detailPanel.activity.appendLine(`A: ${answer}`, _APP_COLORS.white)
    return answer
  }

  private async runAudit(): Promise<void> {
    // Audit runs a build loop with the audit model
    if (!this.selectedIssue || !this.runningOp) {
      return
    }
    const result = await runLoop(
      this.selectedIssue.id,
      'build',
      { ...this.config, buildModel: this.config.auditModel },
      this.provider,
      {
        onEvent: this.makeEventHandler(),
        signal: this.runningOp.abort.signal
      }
    )
    if (result.isErr()) {
      throw result.error
    }
  }

  private async runAuto(): Promise<void> {
    // Auto: plan if NEW, build if PLANNED/IN_PROGRESS
    if (!this.selectedIssue || !this.runningOp) {
      return
    }
    const issue = this.selectedIssue
    const mode = issue.state === 'NEW' || issue.state === 'INTERVIEWING' ? 'plan' : 'build'
    const result = await runLoop(issue.id, mode, this.config, this.provider, {
      onEvent: this.makeEventHandler(),
      signal: this.runningOp.abort.signal
    })
    if (result.isErr()) {
      throw result.error
    }
  }

  private killRunningOp(): void {
    if (this.runningOp) {
      this.runningOp.abort.abort()
      this.detailPanel.activity.appendLine('✖ killed', '#f7768e')
    }
  }

  // ── Issue management ───────────────────────────────────────────────────────

  private createIssue(title: string): void {
    this.provider
      .createIssue({ title })
      .then(result => {
        if (result.isOk()) {
          this.refresh().catch(e => logger.error({ err: e }, 'refresh after create failed'))
        } else {
          logger.error({ err: result.error }, 'create issue failed')
        }
      })
      .catch(e => logger.error({ err: e }, 'create issue threw'))
  }

  private openEditor(): void {
    if (!this.selectedIssue) {
      return
    }
    const editor = process.env['EDITOR'] ?? 'vim'
    const filePath = join(this.config.issuesDir, `${this.selectedIssue.id}.md`)
    try {
      // Temporarily restore terminal to allow editor
      execFileSync(editor, [filePath], { stdio: 'inherit' })
    } catch {
      // Editor exited — that's fine
    }
    this.refresh().catch(e => logger.error({ err: e }, 'refresh after editor failed'))
  }

  // ── Data refresh ───────────────────────────────────────────────────────────

  /**
   * Reloads all issues from the provider and updates the list.
   * Preserves the selected issue if it still exists in the refreshed data.
   *
   * @returns A promise that resolves when the list has been updated.
   */
  async refresh(): Promise<void> {
    const result = await this.provider.listIssues()
    if (result.isErr()) {
      logger.warn({ err: result.error }, 'listIssues failed during refresh')
      return
    }

    this.issues = result.value
    this.issueList.setIssues(this.issues)

    // Re-select previously selected issue, or default to first
    const prevId = this.selectedIssue?.id
    const reselected = prevId ? this.issues.find(i => i.id === prevId) : this.issues[0]

    if (reselected) {
      this.selectedIssue = reselected
      this.detailPanel.setIssue(reselected)
    }
  }
}
