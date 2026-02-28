/**
 * Semantic colour tokens for the dashboard frontend.
 *
 * Every hardcoded hex/rgba value in component files should reference a token
 * from this map instead of inlining the literal. The only files exempt are
 * `theme.ts` (MUI palette) and `styles/themes.ts` (xterm terminal palettes).
 *
 * Organised by visual role so that a colour change propagates everywhere at once.
 */
export const TOKENS = {
  // ── Surfaces ────────────────────────────────────────────────────────
  surfaceOverlayDark: 'rgba(0,0,0,0.3)',
  surfaceOverlayMedium: 'rgba(0,0,0,0.2)',
  surfaceOverlayLight: 'rgba(0,0,0,0.15)',
  surfaceHover: 'rgba(255,255,255,0.05)',
  surfaceCodeInline: 'rgba(148, 163, 184, 0.1)',
  surfaceCodeBlock: 'rgba(0,0,0,0.35)',
  surfaceTableHeader: 'rgba(148,163,184,0.08)',
  surfaceColumnCount: 'rgba(148,163,184,0.1)',

  // ── Borders ─────────────────────────────────────────────────────────
  borderFaint: 'rgba(255,255,255,0.07)',
  borderSubtle: 'rgba(255,255,255,0.08)',
  borderMedium: 'rgba(255,255,255,0.12)',
  borderLight: 'rgba(255,255,255,0.06)',
  borderCodeGroup: '#37474f',
  borderStderrFallback: '#455a64',

  // ── Selection / accent ──────────────────────────────────────────────
  selectionAccent: '#64b5f6',
  selectionBg: 'rgba(100,181,246,0.12)',
  selectionBorder: 'rgba(100,181,246,0.12)',

  // ── Log levels ──────────────────────────────────────────────────────
  logTrace: '#78909c',
  logDebug: '#90a4ae',
  logInfo: '#64b5f6',
  logWarn: '#ffb74d',
  logError: '#e57373',
  logFatal: '#f44336',
  logDone: '#81c784',
  logFallback: '#bdbdbd',
  logMuted: '#9e9e9e',

  // ── Stderr ──────────────────────────────────────────────────────────
  stderrText: '#b0bec5',
  stderrNameTag: '#78909c',
  stderrGroupBullet: '#546e7a',

  // ── Tool badges ─────────────────────────────────────────────────────
  toolGeneric: '#64b5f6',
  toolGenericBg: 'rgba(100,181,246,0.07)',
  toolAgent: '#80cbc4',
  toolAgentBg: 'rgba(128,203,196,0.1)',
  toolSkill: '#ce93d8',
  toolSkillBg: 'rgba(206,147,216,0.1)',

  // ── Token row ───────────────────────────────────────────────────────
  tokenAccent: '#ce93d8',
  tokenBg: 'rgba(206,147,216,0.05)',
  tokenInput: '#b39ddb',
  tokenOutput: '#80cbc4',

  // ── Severity ────────────────────────────────────────────────────────
  severityError: '#e57373',
  severityErrorBg: 'rgba(229,115,115,0.08)',
  severityErrorText: '#ef9a9a',
  severitySuccessBg: 'rgba(129,199,132,0.07)',
  severitySuccessText: '#a5d6a7',
  severityWarnBanner: '#ffb74d',
  severityWarnBg: 'rgba(255,183,77,0.15)',

  // ── Status indicators ───────────────────────────────────────────────
  statusRunning: '#22c55e',
  statusCrashed: '#ef4444',
  statusInactive: 'rgba(148, 163, 184, 0.3)',
  statusSaved: '#22c55e',

  // ── Syntax highlighting (IssueMetadata) ─────────────────────────────
  syntaxKey: '#7dd3fc',
  syntaxString: '#86efac',
  syntaxNumber: '#fda4af',
  syntaxBoolean: '#c4b5fd',
  syntaxNull: '#94a3b8',
  syntaxPunctuation: '#94a3b8',
  syntaxText: '#e2e8f0',

  // ── Code areas ──────────────────────────────────────────────────────
  codeText: '#b0bec5',
  codeMutedText: '#80cbc4',

  // ── Special ─────────────────────────────────────────────────────────
  textOnColor: '#0d0d1a',
  progressTrack: 'rgba(148, 163, 184, 0.1)',

  // ── Session selection (primary-tinted) ──────────────────────────────
  sessionSelectedBorder: 'rgba(167, 139, 250, 0.4)',
  sessionSelectedBg: 'rgba(167, 139, 250, 0.08)',
  sessionSelectedHover: 'rgba(167, 139, 250, 0.12)',
  sessionHover: 'rgba(148, 163, 184, 0.06)',
} as const
