/**
 * Shared issue-related helpers for the dashboard frontend.
 */
import type { Issue } from '@dashboard/frontend/lib/types'

/**
 * Returns the available action commands for a NEW issue based on its triage state.
 *
 * - `needs_interview === undefined` → needs triage first
 * - `needs_interview === true` → ready for interview
 * - `needs_interview === false` → no actions (auto-transitions to GROOMED)
 */
export function getNewIssueActions(issue: Issue): string[] {
  if (issue.needs_interview === undefined) return ['triage']
  if (issue.needs_interview === true) return ['interview']
  return []
}
