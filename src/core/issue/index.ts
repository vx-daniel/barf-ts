import { err, ok, type Result } from 'neverthrow'
import type { z } from 'zod'
import {
  InvalidTransitionError,
  type Issue,
  IssueSchema,
  type IssueState,
} from '@/types'

/**
 * The allowed state transitions in the barf issue lifecycle.
 *
 * Used by {@link validateTransition} to reject illegal moves.
 * Terminal states (`SPLIT`, `VERIFIED`) have empty arrays — no further transitions allowed.
 * `COMPLETED` is an intermediate state; only `VERIFIED` is the true terminal after verification.
 *
 * @category Issue Model
 */
export const VALID_TRANSITIONS: Record<IssueState, IssueState[]> = {
  NEW: ['PLANNED'],
  PLANNED: ['IN_PROGRESS', 'STUCK', 'SPLIT'],
  IN_PROGRESS: ['COMPLETED', 'STUCK', 'SPLIT'],
  STUCK: ['PLANNED', 'NEW', 'SPLIT'],
  SPLIT: [],
  COMPLETED: ['VERIFIED'],
  VERIFIED: [],
}

/**
 * Parses a frontmatter markdown string into a validated {@link Issue}.
 *
 * Expected format:
 * ```
 * ---
 * id=001
 * title=My issue
 * state=NEW
 * parent=
 * children=
 * split_count=0
 * ---
 *
 * Issue body text here.
 * ```
 *
 * @returns `ok(Issue)` on success, `err(ZodError | Error)` if format is invalid.
 * @category Issue Model
 */
export function parseIssue(content: string): Result<Issue, z.ZodError | Error> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return err(
      new Error('Invalid issue format: missing frontmatter delimiters'),
    )
  }
  const [, fm, body] = match
  const fields: Record<string, unknown> = {}
  for (const line of fm.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = line.slice(0, eq)
    const val = line.slice(eq + 1)
    if (key === 'children') {
      fields[key] = val ? val.split(',').filter(Boolean) : []
    } else if (key === 'split_count') {
      fields[key] = parseInt(val, 10)
    } else if (key === 'force_split') {
      fields[key] = val === 'true'
    } else if (key === 'needs_interview') {
      if (val === 'true') {
        fields[key] = true
      } else if (val === 'false') {
        fields[key] = false
      }
      // absent or empty → leave undefined (not set in fields)
    } else if (key === 'verify_count') {
      const parsed = parseInt(val, 10)
      fields[key] = Number.isNaN(parsed) ? 0 : parsed
    } else if (key === 'is_verify_fix' || key === 'verify_exhausted') {
      if (val === 'true') {
        fields[key] = true
      } else if (val === 'false') {
        fields[key] = false
      }
      // absent or empty → leave undefined (not set in fields)
    } else if (key === 'context_usage_percent') {
      const parsed = parseInt(val, 10)
      if (!Number.isNaN(parsed)) {
        fields[key] = parsed
      }
    } else if (
      key === 'total_input_tokens' ||
      key === 'total_output_tokens' ||
      key === 'total_duration_seconds' ||
      key === 'total_iterations' ||
      key === 'run_count'
    ) {
      const parsed = Number(val)
      fields[key] = Number.isNaN(parsed) ? 0 : parsed
    } else {
      fields[key] = val
    }
  }
  fields.body = body.trim()
  const parsed = IssueSchema.safeParse(fields)
  return parsed.success ? ok(parsed.data) : err(parsed.error)
}

/**
 * Serializes an {@link Issue} to frontmatter markdown.
 * Round-trips cleanly with {@link parseIssue}.
 *
 * @category Issue Model
 */
export function serializeIssue(issue: Issue): string {
  const fm: string[] = [
    `id=${issue.id}`,
    `title=${issue.title}`,
    `state=${issue.state}`,
    `parent=${issue.parent}`,
    `children=${issue.children.join(',')}`,
    `split_count=${issue.split_count}`,
    `force_split=${issue.force_split}`,
  ]
  if (issue.context_usage_percent !== undefined) {
    fm.push(`context_usage_percent=${issue.context_usage_percent}`)
  }
  if (issue.needs_interview !== undefined) {
    fm.push(`needs_interview=${issue.needs_interview}`)
  }
  fm.push(`verify_count=${issue.verify_count}`)
  if (issue.is_verify_fix !== undefined) {
    fm.push(`is_verify_fix=${issue.is_verify_fix}`)
  }
  if (issue.verify_exhausted !== undefined) {
    fm.push(`verify_exhausted=${issue.verify_exhausted}`)
  }
  fm.push(`total_input_tokens=${issue.total_input_tokens}`)
  fm.push(`total_output_tokens=${issue.total_output_tokens}`)
  fm.push(`total_duration_seconds=${issue.total_duration_seconds}`)
  fm.push(`total_iterations=${issue.total_iterations}`)
  fm.push(`run_count=${issue.run_count}`)
  return `---\n${fm.join('\n')}\n---\n\n${issue.body}\n`
}

/**
 * Validates a proposed state transition against {@link VALID_TRANSITIONS}.
 *
 * @param from - Current state of the issue
 * @param to - Desired next state to transition to
 * @returns `ok(undefined)` if the transition is permitted,
 *   `err(InvalidTransitionError)` if it is not.
 * @category Issue Model
 */
export function validateTransition(
  from: IssueState,
  to: IssueState,
): Result<void, InvalidTransitionError> {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    return err(new InvalidTransitionError(from, to))
  }
  return ok(undefined)
}

/**
 * Returns `true` if all acceptance criteria checkboxes are checked.
 *
 * Scans the `## Acceptance Criteria` section for `- [ ]` unchecked items.
 * Returns `true` when none are found, or when the section is absent entirely.
 *
 * @param content - Raw issue body (the markdown text after the frontmatter `---`).
 * @category Issue Model
 */
export function parseAcceptanceCriteria(content: string): boolean {
  const section = content.match(
    /## Acceptance Criteria\n([\s\S]*?)(?=\n## |\s*$)/,
  )
  if (!section) {
    return true
  }
  return !section[1].includes('- [ ]')
}
