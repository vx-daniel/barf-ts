/**
 * Session index writer — appends session lifecycle events to `.barf/sessions.jsonl`.
 *
 * Called by {@link runLoop} at lock acquisition (start) and in the `finally`
 * block (end). The auto command writes `auto_start`/`auto_end` wrapper events.
 *
 * The file is append-only and never read by the core — only the dashboard
 * service reads it for the session browser panel.
 *
 * @module Orchestration
 */
import { appendFileSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import type { LoopMode } from '@/types/schema/mode-schema'
import type {
  AuditGateEvent,
  AutoEndEvent,
  AutoStartEvent,
  SessionArchiveEvent,
  SessionDeleteEvent,
  SessionEndEvent,
  SessionStartEvent,
} from '@/types/schema/session-index-schema'
import { createLogger } from '@/utils/logger'

const logger = createLogger('session-index')

/**
 * Returns the current byte size of a file, or 0 if the file does not exist.
 *
 * @param filePath - Absolute path to the file.
 */
export function getFileSize(filePath: string): number {
  try {
    return statSync(filePath).size
  } catch {
    return 0
  }
}

/**
 * Appends a JSON line to the session index file.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param event - Session event to write.
 */
function appendEvent(barfDir: string, event: object): void {
  try {
    mkdirSync(barfDir, { recursive: true })
    const indexPath = join(barfDir, 'sessions.jsonl')
    appendFileSync(indexPath, `${JSON.stringify(event)}\n`)
  } catch (e) {
    logger.warn(
      { err: e instanceof Error ? e.message : String(e) },
      'failed to write session index event',
    )
  }
}

/**
 * Generates a unique session ID for an issue session.
 *
 * @param issueId - The issue being processed.
 */
export function makeSessionId(issueId: string): string {
  return `${issueId}-${Date.now()}`
}

/**
 * Generates a unique session ID for an auto run.
 */
export function makeAutoSessionId(): string {
  return `auto-${Date.now()}`
}

/**
 * Writes a session start event to the index.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param sessionId - Unique session identifier.
 * @param issueId - Issue being processed.
 * @param mode - Orchestration mode.
 * @param model - Model used.
 * @param streamFile - Path to the issue's stream JSONL file (for byte offset).
 * @param parentSessionId - Parent auto session ID, if applicable.
 */
export function writeSessionStart(
  barfDir: string,
  sessionId: string,
  issueId: string,
  mode: LoopMode,
  model: string,
  streamFile: string | undefined,
  parentSessionId?: string,
): void {
  const event: SessionStartEvent = {
    event: 'start',
    sessionId,
    pid: process.pid,
    issueId,
    mode,
    model,
    timestamp: new Date().toISOString(),
    streamOffset: streamFile ? getFileSize(streamFile) : 0,
    ...(parentSessionId ? { parentSessionId } : {}),
  }
  appendEvent(barfDir, event)
}

/**
 * Writes a session end event to the index.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param sessionId - Session identifier matching the start event.
 * @param streamFile - Path to the issue's stream JSONL file (for end offset).
 * @param inputTokens - Total input tokens consumed.
 * @param outputTokens - Total output tokens consumed.
 * @param iterations - Number of iterations executed.
 * @param durationSeconds - Wall-clock duration.
 */
export function writeSessionEnd(
  barfDir: string,
  sessionId: string,
  streamFile: string | undefined,
  inputTokens: number,
  outputTokens: number,
  iterations: number,
  durationSeconds: number,
): void {
  const event: SessionEndEvent = {
    event: 'end',
    sessionId,
    pid: process.pid,
    timestamp: new Date().toISOString(),
    streamEndOffset: streamFile ? getFileSize(streamFile) : 0,
    inputTokens,
    outputTokens,
    iterations,
    durationSeconds,
  }
  appendEvent(barfDir, event)
}

/**
 * Writes an auto_start event to the index.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param sessionId - Auto session identifier.
 */
export function writeAutoStart(barfDir: string, sessionId: string): void {
  const event: AutoStartEvent = {
    event: 'auto_start',
    sessionId,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  }
  appendEvent(barfDir, event)
}

/**
 * Writes an auto_end event to the index.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param sessionId - Auto session identifier.
 * @param issueCount - Number of issues processed.
 */
export function writeAutoEnd(
  barfDir: string,
  sessionId: string,
  issueCount: number,
): void {
  const event: AutoEndEvent = {
    event: 'auto_end',
    sessionId,
    pid: process.pid,
    timestamp: new Date().toISOString(),
    issueCount,
  }
  appendEvent(barfDir, event)
}

/**
 * Writes a delete event to the index, marking a session as removed.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param sessionId - Session identifier to delete.
 */
export function writeSessionDelete(barfDir: string, sessionId: string): void {
  const event: SessionDeleteEvent = {
    event: 'delete',
    sessionId,
    timestamp: new Date().toISOString(),
  }
  appendEvent(barfDir, event)
}

/**
 * Writes an archive event to the index, hiding a session from the default view.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param sessionId - Session identifier to archive.
 */
export function writeSessionArchive(barfDir: string, sessionId: string): void {
  const event: SessionArchiveEvent = {
    event: 'archive',
    sessionId,
    timestamp: new Date().toISOString(),
  }
  appendEvent(barfDir, event)
}

/**
 * Writes an audit gate state transition event to the session index.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param gateState - The gate state being entered.
 * @param opts - Optional metadata: `triggeredBy` for initial trigger, `fixIssueCount` for fixing transition.
 */
export function writeAuditGateEvent(
  barfDir: string,
  gateState: AuditGateEvent['gateState'],
  opts?: {
    triggeredBy?: AuditGateEvent['triggeredBy']
    fixIssueCount?: number
  },
): void {
  const event: AuditGateEvent = {
    event: 'audit_gate',
    gateState,
    timestamp: new Date().toISOString(),
    ...(opts?.triggeredBy ? { triggeredBy: opts.triggeredBy } : {}),
    ...(opts?.fixIssueCount !== undefined
      ? { fixIssueCount: opts.fixIssueCount }
      : {}),
  }
  appendEvent(barfDir, event)
}
