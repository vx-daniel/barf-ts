import { z } from 'zod';
import { Result, ok, err } from 'neverthrow';
import { IssueSchema, type Issue, type IssueState, InvalidTransitionError } from '../types/index.js';

export const VALID_TRANSITIONS: Record<IssueState, IssueState[]> = {
  NEW:         ['PLANNED'],
  PLANNED:     ['IN_PROGRESS', 'STUCK', 'SPLIT'],
  IN_PROGRESS: ['COMPLETED', 'STUCK', 'SPLIT'],
  STUCK:       ['PLANNED', 'SPLIT'],
  SPLIT:       [],
  COMPLETED:   [],
};

export function parseIssue(content: string): Result<Issue, z.ZodError | Error> {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return err(new Error('Invalid issue format: missing frontmatter delimiters'));
  const [, fm, body] = match;
  const fields: Record<string, unknown> = {};
  for (const line of fm.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq);
    const val = line.slice(eq + 1);
    if (key === 'children') fields[key] = val ? val.split(',').filter(Boolean) : [];
    else if (key === 'split_count') fields[key] = parseInt(val, 10);
    else fields[key] = val;
  }
  fields['body'] = body.trim();
  const parsed = IssueSchema.safeParse(fields);
  return parsed.success ? ok(parsed.data) : err(parsed.error);
}

export function serializeIssue(issue: Issue): string {
  const fm = [
    `id=${issue.id}`,
    `title=${issue.title}`,
    `state=${issue.state}`,
    `parent=${issue.parent}`,
    `children=${issue.children.join(',')}`,
    `split_count=${issue.split_count}`,
  ].join('\n');
  return `---\n${fm}\n---\n\n${issue.body}\n`;
}

export function validateTransition(
  from: IssueState,
  to: IssueState,
): Result<void, InvalidTransitionError> {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    return err(new InvalidTransitionError(from, to));
  }
  return ok(undefined);
}

export function parseAcceptanceCriteria(content: string): boolean {
  const section = content.match(/## Acceptance Criteria\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!section) return true;
  return !section[1].includes('- [ ]');
}
