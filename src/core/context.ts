/**
 * Thrown when cumulative token usage reaches the configured context threshold.
 * Caught and converted to an `'overflow'` outcome by `runClaudeIteration`.
 *
 * @category Claude Agent
 */
export class ContextOverflowError extends Error {
  constructor(public readonly tokens: number) {
    super(`Context threshold exceeded: ${tokens} tokens`)
    this.name = 'ContextOverflowError'
  }
}

/**
 * Thrown when Claude's API returns a rate-limit event during an iteration.
 * Caught and converted to a `'rate_limited'` outcome by `runClaudeIteration`.
 * `resetsAt` is a Unix timestamp (seconds) if provided by the API.
 *
 * @category Claude Agent
 */
export class RateLimitError extends Error {
  constructor(public readonly resetsAt?: number) {
    const resetStr = resetsAt
      ? new Date(resetsAt * 1000).toLocaleTimeString()
      : 'soon'
    super(`Rate limited until ${resetStr}`)
    this.name = 'RateLimitError'
  }
}

/**
 * Injects template variables into a prompt string.
 * Simple string replacement — no eval, no shell, injection-safe.
 *
 * Each key in `vars` is matched against `$KEY` and `${KEY}` patterns in the template.
 * Values are stringified via `String()`.
 *
 * @param template - Raw prompt template containing `$KEY` or `${KEY}` placeholders.
 * @param vars - Key-value pairs to substitute. Keys should match the placeholder names exactly.
 * @returns The template string with all recognized placeholders replaced by their string values.
 * @category Claude Agent
 */
export function injectTemplateVars(
  template: string,
  vars: Record<string, string | number>,
): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\$\\{?${key}\\}?`, 'g'), String(value))
  }
  return result
}
