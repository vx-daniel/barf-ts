/**
 * TTY display functions — progress rendering for Claude iterations.
 *
 * These pure functions handle the terminal output during Claude sessions:
 * a sticky header line showing what's running, a progress line showing
 * context usage, and ANSI escape sequences to clear them when done.
 *
 * Extracted from the stream consumer so display logic is independently
 * testable and the stream module can focus on message processing.
 *
 * @module Orchestration
 */
import type { DisplayContext } from '@/types'

/**
 * Maximum length for issue titles in the TTY header.
 * Titles longer than this are truncated with an ellipsis.
 */
const MAX_TITLE_LENGTH = 50

/**
 * Writes the sticky header line identifying the current operation.
 *
 * Renders a single line like:
 * ```
 * ▶ build  ISSUE-123  IN_PROGRESS  Fix the login bug
 * ```
 *
 * @param displayContext - Context fields for the header (mode, issueId, state, title).
 * @param stderrWrite - Sink function for TTY output (typically `process.stderr.write`).
 * @category Display
 */
export function writeHeader(
  displayContext: DisplayContext,
  stderrWrite: (data: string) => void,
): void {
  const rawTitle = displayContext.title
  const title =
    rawTitle.length > MAX_TITLE_LENGTH
      ? `${rawTitle.slice(0, MAX_TITLE_LENGTH - 3)}...`
      : rawTitle
  stderrWrite(
    `▶ ${displayContext.mode}  ${displayContext.issueId}  ${displayContext.state}  ${title}\n`,
  )
}

/**
 * Writes the context usage progress line.
 *
 * Overwrites the current line (using `\r\x1b[K`) with:
 * ```
 *   context: 150,000 / 200,000 (75%)  |  Read
 * ```
 *
 * @param tokens - Current cumulative input token count.
 * @param contextLimit - Model's total context window size.
 * @param lastTool - Name of the most recent tool invocation (empty string if none).
 * @param stderrWrite - Sink function for TTY output.
 * @category Display
 */
export function writeProgress(
  tokens: number,
  contextLimit: number,
  lastTool: string,
  stderrWrite: (data: string) => void,
  issueId?: string,
): void {
  const pct = Math.round((tokens / contextLimit) * 100)
  const toolPart = lastTool ? `  |  ${lastTool}` : ''
  const prefix = issueId ? `[${issueId}] ` : ''
  stderrWrite(
    `\r\x1b[K  ${prefix}context: ${tokens.toLocaleString()} / ${contextLimit.toLocaleString()} (${pct}%)${toolPart}`,
  )
}

/**
 * Clears the progress line (and header line if present) using ANSI escape sequences.
 *
 * When a header was written (displayContext provided), clears two lines
 * (progress + header). Otherwise clears just the progress line.
 *
 * @param hasHeader - Whether a header line was written above the progress line.
 * @param stderrWrite - Sink function for TTY output.
 * @category Display
 */
export function clearProgress(
  hasHeader: boolean,
  stderrWrite: (data: string) => void,
): void {
  stderrWrite(hasHeader ? '\r\x1b[K\x1b[1A\r\x1b[K' : '\r\x1b[K')
}
