/**
 * Verification formatting — markdown body generation for fix sub-issues.
 *
 * When verification fails, barf creates a child issue containing the failure
 * details. This module formats those details into a structured markdown body
 * with code-fenced output sections and acceptance criteria checkboxes.
 *
 * @module verification/format
 */
import type { VerifyFailure } from '@/types'

/**
 * Builds the markdown body for a fix sub-issue from verification failures.
 *
 * Each failure becomes a `### checkName` section with code-fenced stdout/stderr.
 * The body includes context about why the fix issue was created and standard
 * acceptance criteria that the fix must satisfy.
 *
 * @param issueId - ID of the parent issue whose verification failed.
 * @param failures - List of failed verification checks with their output.
 * @returns Markdown body string ready for the fix sub-issue.
 * @category Verification
 */
export function buildFixBody(
  issueId: string,
  failures: VerifyFailure[],
): string {
  const sections = failures
    .map((f) => {
      const output = [f.stdout, f.stderr].filter(Boolean).join('\n').trim()
      return `### ${f.check}\n\`\`\`\n${output}\n\`\`\``
    })
    .join('\n\n')

  return `## Context
Issue ${issueId} was marked COMPLETED but failed automated verification.

## Failures

${sections}

## Acceptance Criteria
- [ ] \`bun run build\` passes
- [ ] \`bun run check\` passes (format + lint)
- [ ] \`bun test\` passes`
}
