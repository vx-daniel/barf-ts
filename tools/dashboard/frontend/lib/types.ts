/**
 * Frontend-only types for the dashboard panels.
 * Re-exports shared types from `src/` so panel code can import from one place.
 */
// export type {
//   ActivityEntry,
//   ActivityKind,
//   ActivitySource,
// } from '@/types/schema/activity-schema'
export type { Issue } from '@/types/schema/issue-schema'
export type { Session } from '@/types/schema/session-index-schema'

// Import ActivityKind for interface usage
import type { ActivityKind } from '@/types/schema/activity-schema'

/**
 * A rendered activity entry for the reactive activity log.
 * Extends the raw {@link ActivityEntry} with a stable key for React-style
 * keyed rendering and an optional resolved tool result.
 */
export interface ProcessedEntry {
  key: string
  kind: ActivityKind
  timestamp: number
  issueId?: string
  issueName?: string
  data: Record<string, unknown>
  /** For tool_call entries: resolved result once the tool_result arrives. */
  toolResult?: { content: string; isError: boolean }
  /** For synthetic termLog entries: CSS type suffix (e.g. 'info', 'error', 'done'). */
  termType?: string
  /** For synthetic termLog entries: the display text. */
  termText?: string
}

/** A task item extracted from Claude's TaskCreate/TaskUpdate tool calls. */
export interface TodoItem {
  id: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}
