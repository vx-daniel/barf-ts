/**
 * Activity log types — shared between the dashboard frontend and server-side
 * activity aggregator.
 *
 * These types describe the structured events displayed in the dashboard's
 * real-time activity feed. They have no validation logic (plain TS types,
 * not Zod schemas) since they're constructed programmatically, not parsed
 * from untrusted input.
 *
 * @module Configuration
 */

/**
 * Discriminates the kind of activity entry displayed in the activity log.
 * Maps to the event types emitted by the barf orchestration loop over SSE.
 */
export type ActivityKind =
  | 'stdout'
  | 'stderr'
  | 'tool_call'
  | 'tool_result'
  | 'token_update'
  | 'result'
  | 'error'

/**
 * Origin of an activity entry — whether it came from a CLI subprocess
 * (`command`) or directly from the Claude SDK stream (`sdk`).
 */
export type ActivitySource = 'command' | 'sdk'

/**
 * A single entry in the real-time activity feed, representing one event from
 * the barf orchestration loop (tool call, token update, error, etc.).
 */
export interface ActivityEntry {
  timestamp: number
  source: ActivitySource
  kind: ActivityKind
  issueId?: string
  issueName?: string
  data: Record<string, unknown>
}
