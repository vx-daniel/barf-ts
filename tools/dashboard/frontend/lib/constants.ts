/**
 * Shared display constants for issue states and commands.
 *
 * These are the single source of truth for state colours, labels, ordering,
 * and the command actions available per state. Import from here — do not
 * redeclare locally in panel files.
 */

/** Canonical rendering order for kanban columns. */
export const STATE_ORDER = [
  'NEW',
  'GROOMED',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
  'STUCK',
  'SPLIT',
] as const

/** Accent colour for each {@link IssueState} value, used for badges and borders. */
export const STATE_COLORS = {
  NEW: '#6b7280',
  GROOMED: '#3b82f6',
  PLANNED: '#f59e0b',
  IN_PROGRESS: '#f97316',
  COMPLETED: '#22c55e',
  VERIFIED: '#10b981',
  STUCK: '#ef4444',
  SPLIT: '#a855f7',
} satisfies Record<string, string>

/** Human-readable label for each {@link IssueState} value. */
export const STATE_LABELS = {
  NEW: 'NEW',
  GROOMED: 'GROOMED',
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN PROGRESS',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  STUCK: 'STUCK',
  SPLIT: 'SPLIT',
} satisfies Record<string, string>

/** CLI commands available to run for issues in each state. */
export const CMD_ACTIONS = {
  NEW: [],
  GROOMED: ['plan'],
  PLANNED: ['plan', 'build'],
  IN_PROGRESS: ['build'],
  COMPLETED: ['audit'],
  VERIFIED: [],
  STUCK: ['plan'],
  SPLIT: [],
} satisfies Record<string, string[]>

/**
 * Returns the accent colour for a given issue state, falling back to the
 * neutral grey used by NEW when the state is unrecognised.
 *
 * Prefer this over indexing {@link STATE_COLORS} directly — it encapsulates
 * the cast and the fallback in one place.
 *
 * @param state - An {@link IssueState} string value
 * @returns A CSS hex colour string
 */
export function stateColor(state: string): string {
  return (STATE_COLORS as Record<string, string>)[state] ?? STATE_COLORS.NEW
}

/** CSS class applied to action buttons, keyed by command name. */
export const CMD_CLASS = {
  plan: 'abtn-plan',
  build: 'abtn-build',
  audit: 'abtn-audit',
  triage: 'abtn-triage',
  interview: 'abtn-interview',
} satisfies Record<string, string>
