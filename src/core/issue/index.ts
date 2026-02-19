import { z } from 'zod'
import { Result, ok, err } from 'neverthrow'
import { IssueSchema, type Issue, type IssueState, InvalidTransitionError } from '@/types'

/**
 * The allowed state transitions in the barf issue lifecycle.
 *
 * Used by {@link validateTransition} to reject illegal moves.
 * Terminal states (`SPLIT`, `COMPLETED`) have empty arrays — no further transitions allowed.
 *
 * @category Issue Model
 */
export const VALID_TRANSITIONS: Record<IssueState, IssueState[]> = {
  NEW: ['PLANNED'],
  PLANNED: ['IN_PROGRESS', 'STUCK', 'SPLIT'],
  IN_PROGRESS: ['COMPLETED', 'STUCK', 'SPLIT'],
  STUCK: ['PLANNED', 'SPLIT'],
  SPLIT: [],
  COMPLETED: []
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
    return err(new Error('Invalid issue format: missing frontmatter delimiters'))
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
    } else {
      fields[key] = val
    }
  }
  fields['body'] = body.trim()
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
  const fm = [
    `id=${issue.id}`,
    `title=${issue.title}`,
    `state=${issue.state}`,
    `parent=${issue.parent}`,
    `children=${issue.children.join(',')}`,
    `split_count=${issue.split_count}`
  ].join('\n')
  return `---\n${fm}\n---\n\n${issue.body}\n`
}

/**
 * Validates a proposed state transition against {@link VALID_TRANSITIONS}.
 *
 * @returns `ok(undefined)` if the transition is permitted,
 *   `err(InvalidTransitionError)` if it is not.
 * @category Issue Model
 */
export function validateTransition(
  from: IssueState,
  to: IssueState
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
  const section = content.match(/## Acceptance Criteria\n([\s\S]*?)(?=\n## |\s*$)/)
  if (!section) {
    return true
  }
  return !section[1].includes('- [ ]')
}
