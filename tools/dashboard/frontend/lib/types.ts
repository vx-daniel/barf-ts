/**
 * Frontend-only types for the dashboard panels.
 */

export type ActivityKind =
  | 'stdout'
  | 'stderr'
  | 'tool_call'
  | 'token_update'
  | 'result'
  | 'error'

export type ActivitySource = 'command' | 'sdk'

export interface ActivityEntry {
  timestamp: number
  source: ActivitySource
  kind: ActivityKind
  data: Record<string, unknown>
}

export interface StatusData {
  issueId: string | null
  state: string
  totalInputTokens: number
  totalOutputTokens: number
  contextUsagePercent: number | null
  runCount: number
  totalDurationSeconds: number
  activeCommand: string | null
  commandStartTime: number | null
  models: {
    planModel: string
    buildModel: string
    auditModel: string
  } | null
}

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
