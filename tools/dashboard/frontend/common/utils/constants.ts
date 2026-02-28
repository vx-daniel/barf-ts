/**
 * Shared display constants for issue states and commands.
 *
 * Single source of truth for state colours, labels, ordering,
 * and the command actions available per state.
 */
import type { IssueState } from '@/types/schema/issue-schema'
import { STATE_PALETTE, CMD_PALETTE } from '@dashboard/frontend/theme'

/**
 * Canonical rendering order for kanban columns.
 * Side-states (`STUCK`, `SPLIT`) placed at end for cleaner kanban layout.
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
 * Hex colour for each {@link IssueState}, sourced from the MUI theme palette.
 */
export const STATE_COLORS: Record<IssueState, string> = {
  NEW: STATE_PALETTE.new,
  GROOMED: STATE_PALETTE.groomed,
  PLANNED: STATE_PALETTE.planned,
  IN_PROGRESS: STATE_PALETTE.inProgress,
  COMPLETED: STATE_PALETTE.completed,
  VERIFIED: STATE_PALETTE.verified,
  STUCK: STATE_PALETTE.stuck,
  SPLIT: STATE_PALETTE.split,
}

/** Linear issue lifecycle for progress display (no STUCK/SPLIT). */
export const PIPELINE_STATES: readonly IssueState[] = [
  'NEW',
  'GROOMED',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
]

/** Human-readable label per state. */
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

/** Emoji glyph per state. */
export const STATE_EMOJI: Record<IssueState, string> = {
  NEW: '\u{1F195}',
  GROOMED: '\u{1F487}',
  PLANNED: '\u{1F4CB}',
  IN_PROGRESS: '\u{1F528}',
  COMPLETED: '\u2705',
  VERIFIED: '\u{1F3C6}',
  STUCK: '\u{1F6A7}',
  SPLIT: '\u{1FA93}',
}

/** General-purpose icon glyphs. */
export const ICON = {
  agent: '\u{1F916}',
  assistant: '\u{1F47E}',
  archive: '\u{1F4E6}',
  bug: '\u{1F41B}',
  chat: '\u{1F4AC}',
  clock: '\u23F1\uFE0F',
  delete: '\u{1F5D1}\uFE0F',
  edit: '\u270F\uFE0F',
  error: '\u274C',
  file: '\u{1F4C4}',
  fin: '\u{1F3C1}',
  fire: '\u{1F525}',
  folder: '\u{1F4C1}',
  go: '\u{1F680}',
  info: '\u2139\uFE0F',
  link: '\u{1F517}',
  no: '\u{1F6AB}',
  party: '\u{1F389}',
  refresh: '\u{1F504}',
  run: '\u26A1',
  search: '\u{1F50D}',
  spark: '\u2728',
  star: '\u2B50',
  stop: '\u{1F6D1}',
  success: '\u2705',
  terminal: '\u{1F4BB}',
  tool: '\u{1F527}',
  warning: '\u26A0\uFE0F',
  user: '\u{1F913}',
} as const satisfies Record<string, string>

export type IconKey = keyof typeof ICON

/** CLI commands available per state. */
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

/** Accent colour per command. */
export const CMD_COLORS: Record<string, string> = {
  plan: CMD_PALETTE.plan,
  build: CMD_PALETTE.build,
  audit: CMD_PALETTE.audit,
  triage: CMD_PALETTE.triage,
  interview: CMD_PALETTE.interview,
}

/** Safe state colour lookup with fallback. */
export function stateColor(state: IssueState | string): string {
  return STATE_COLORS[state as IssueState] ?? STATE_COLORS.NEW
}

/** Safe state emoji lookup with fallback. */
export function stateEmoji(state: IssueState | string): string {
  return STATE_EMOJI[state as IssueState] ?? '\u26AA'
}

/** Context bar colour based on usage percentage. */
export function contextBarColor(pct: number): string {
  if (pct > 80) return STATE_PALETTE.stuck
  if (pct > 60) return STATE_PALETTE.inProgress
  return STATE_PALETTE.verified
}

/** Safe icon lookup with fallback. */
export function icon(key: IconKey | string): string {
  return ICON[key as IconKey] ?? ''
}
