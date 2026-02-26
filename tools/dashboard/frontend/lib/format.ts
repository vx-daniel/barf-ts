/**
 * Number and duration formatting helpers for the dashboard UI.
 */

/** Formats large numbers with K/M suffixes (e.g. 1500 → "1.5K"). */
export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Formats seconds into human-readable duration (e.g. 125 → "2m 5s"). */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
