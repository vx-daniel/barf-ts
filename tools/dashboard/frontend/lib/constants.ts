/**
 * Shared display constants for issue states and commands.
 *
 * These are the single source of truth for state colours, labels, ordering,
 * and the command actions available per state. Import from here — do not
 * redeclare locally in panel files.
 *
 * All state maps are typed as `Record<IssueState, ...>` so adding a new state
 * to {@link IssueStateSchema} causes a compile error here until updated.
 */
import type { IssueState } from '@/types/schema/issue-schema'

/**
 * Canonical rendering order for kanban columns.
 * Differs from {@link IssueStateSchema} order — side-states (`STUCK`, `SPLIT`)
 * are placed at the end for a cleaner kanban layout.
 */
export const STATE_ORDER: readonly IssueState[] = [
  'NEW',
  'GROOMED',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
  'STUCK',
  'SPLIT',
]

/**
 * Accent colour for each {@link IssueState} value, used for badges and borders.
 * Values reference CSS custom properties defined in the `@theme` block
 * (`styles/index.css`) so the palette has a single source of truth.
 */
export const STATE_COLORS: Record<IssueState, string> = {
  NEW: 'var(--color-state-new)',
  GROOMED: 'var(--color-state-groomed)',
  PLANNED: 'var(--color-state-planned)',
  IN_PROGRESS: 'var(--color-state-in-progress)',
  COMPLETED: 'var(--color-state-completed)',
  VERIFIED: 'var(--color-state-verified)',
  STUCK: 'var(--color-state-stuck)',
  SPLIT: 'var(--color-state-split)',
}

/** Human-readable label for each {@link IssueState} value. */
export const STATE_LABELS: Record<IssueState, string> = {
  NEW: 'NEW',
  GROOMED: 'GROOMED',
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN PROGRESS',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  STUCK: 'STUCK',
  SPLIT: 'SPLIT',
}

/** CLI commands available to run for issues in each state. */
export const CMD_ACTIONS: Record<IssueState, string[]> = {
  NEW: [],
  GROOMED: ['plan'],
  PLANNED: ['plan', 'build'],
  IN_PROGRESS: ['build'],
  COMPLETED: ['audit'],
  VERIFIED: [],
  STUCK: ['plan'],
  SPLIT: [],
}

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
export function stateColor(state: IssueState | string): string {
  return STATE_COLORS[state as IssueState] ?? STATE_COLORS.NEW
}

/**
 * Returns a red/orange/green colour based on context usage percentage.
 * Used for progress bar fills on kanban cards.
 *
 * @param pct - Context usage percentage (0-100)
 * @returns A CSS hex colour string
 */
export function contextBarColor(pct: number): string {
  if (pct > 80) return 'var(--color-danger)'
  if (pct > 60) return 'var(--color-state-in-progress)'
  return 'var(--color-success)'
}

/** CSS class applied to action buttons, keyed by command name. */
export const CMD_CLASS = {
  plan: 'abtn-plan',
  build: 'abtn-build',
  audit: 'abtn-audit',
  triage: 'abtn-triage',
  interview: 'abtn-interview',
} satisfies Record<string, string>
