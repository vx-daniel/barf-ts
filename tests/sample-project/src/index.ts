/**
 * String utility library.
 * All functions are pure — no side effects.
 */

/** Reverses a string. */
export function reverse(s: string): string {
  return s.split('').reverse().join('');
}

/** Truncates a string to `maxLen` characters, appending `…` if cut. */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '…';
}
