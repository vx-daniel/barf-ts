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

/**
 * Linear issue lifecycle for progress display.
 * Excludes side-states STUCK and SPLIT which are not part of the happy path.
 */
export const PIPELINE_STATES: readonly IssueState[] = [
  'NEW',
  'GROOMED',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
]

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

/** Emoji glyph for each {@link IssueState}, usable in badges, tooltips, and log output. */
export const STATE_EMOJI: Record<IssueState, string> = {
  NEW: '🆕',
  GROOMED: '💇',
  PLANNED: '📋',
  IN_PROGRESS: '🔨',
  COMPLETED: '✅',
  VERIFIED: '🏆',
  STUCK: '🚧',
  SPLIT: '🪓',
}

/** General-purpose icon glyphs for UI actions, labels, and decorators. */
export const ICON = {
  agent: '🤖',
  assistant: '👾',
  // assistant: '🎪',
  archive: '📦',
  arr: '🏴‍☠️',
  bug: '🐛',
  chat: '💬',
  clock: '⏱️',
  clown: '🤡',
  curse: '🤬',
  delete: '🗑️',
  devil: '👹',
  doctor: '🩺',
  edit: '✏️',
  error: '❌',
  eye: '👁️',
  file: '📄',
  fin: '🏁',
  fire: '🔥',
  folder: '📁',
  go: '🚀',
  info: 'ℹ️',
  link: '🔗',
  lock: '🔒',
  luck: '🥠',
  no: '🚫',
  party: '🎉',
  poop: '💩',
  refresh: '🔄',
  run: '⚡',
  search: '🔍',
  skull: '💀',
  spark: '✨',
  star: '⭐',
  stop: '🛑',
  success: '✅',
  terminal: '💻',
  tool: '🔧',
  unlock: '🔓',
  warning: '⚠️',
  yolo: '🎰',
  user: '🤓',
} as const satisfies Record<string, string>

/** Type-safe icon key. */
export type IconKey = keyof typeof ICON

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
 * Returns the emoji for a given issue state, falling back to a generic circle
 * when the state is unrecognised.
 *
 * @param state - An {@link IssueState} string value
 * @returns An emoji string
 */
export function stateEmoji(state: IssueState | string): string {
  return STATE_EMOJI[state as IssueState] ?? '⚪'
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

/**
 * Returns the icon glyph for a given {@link IconKey}, falling back to an
 * empty string when the key is unrecognised.
 *
 * @param key - An {@link IconKey} string value
 * @returns An emoji string or empty string
 */
export function icon(key: IconKey | string): string {
  return ICON[key as IconKey] ?? ''
}

/** CSS class applied to action buttons, keyed by command name. */
export const CMD_CLASS = {
  plan: 'var(--color-state-in-plan)',
  build: 'var(--color-state-in-build)',
  audit: 'var(--color-state-in-audit)',
  triage: 'var(--color-state-in-triage)',
  interview: 'var(--color-state-in-interview)',
} satisfies Record<string, string>
