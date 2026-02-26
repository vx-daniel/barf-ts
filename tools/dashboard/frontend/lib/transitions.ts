/**
 * Valid state transitions for the dashboard frontend.
 *
 * Mirrors the server-side `VALID_TRANSITIONS` in `src/core/issue/index.ts`.
 * If the server transitions change, this must be updated to match.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['GROOMED', 'STUCK'],
  GROOMED: ['PLANNED', 'STUCK', 'SPLIT'],
  PLANNED: ['IN_PROGRESS', 'STUCK', 'SPLIT'],
  IN_PROGRESS: ['COMPLETED', 'STUCK', 'SPLIT'],
  STUCK: ['PLANNED', 'NEW', 'GROOMED', 'SPLIT'],
  SPLIT: [],
  COMPLETED: ['VERIFIED'],
  VERIFIED: [],
}
