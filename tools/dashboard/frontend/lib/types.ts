/**
 * Frontend-only types for the dashboard panels.
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

/**
 * Represents a barf issue as returned by the `/api/issues` REST endpoints.
 * Mirrors the frontmatter fields parsed by the issue provider.
 */
export interface Issue {
  id: string
  title: string
  state: string
  parent: string
  children: string[]
  split_count: number
  force_split: boolean
  context_usage_percent?: number
  needs_interview?: boolean
  verify_count: number
  is_verify_fix?: boolean
  verify_exhausted?: boolean
  total_input_tokens: number
  total_output_tokens: number
  total_duration_seconds: number
  total_iterations: number
  run_count: number
  body: string
}
