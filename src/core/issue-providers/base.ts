import { ResultAsync, errAsync } from 'neverthrow';
import type { Issue, IssueState } from '../../types/index.js';
import { validateTransition, parseAcceptanceCriteria } from '../issue.js';

export type AutoSelectMode = 'plan' | 'build';

const AUTO_SELECT_PRIORITY: Record<AutoSelectMode, IssueState[]> = {
  plan:  ['NEW'],
  build: ['IN_PROGRESS', 'PLANNED', 'NEW'],
};

export abstract class IssueProvider {
  // ── Abstract I/O — implemented per provider ───────────────────────────────

  abstract fetchIssue(id: string): ResultAsync<Issue, Error>;
  abstract listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error>;
  abstract createIssue(input: { title: string; body?: string; parent?: string }): ResultAsync<Issue, Error>;
  abstract writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): ResultAsync<Issue, Error>;
  abstract deleteIssue(id: string): ResultAsync<void, Error>;
  abstract lockIssue(id: string): ResultAsync<void, Error>;
  abstract unlockIssue(id: string): ResultAsync<void, Error>;
  abstract isLocked(id: string): ResultAsync<boolean, Error>;

  // ── Shared logic — one implementation for all providers ───────────────────

  transition(id: string, to: IssueState): ResultAsync<Issue, Error> {
    return this.fetchIssue(id).andThen((issue) => {
      const validation = validateTransition(issue.state, to);
      if (validation.isErr()) return errAsync(validation.error);
      return this.writeIssue(id, { state: to });
    });
  }

  autoSelect(mode: AutoSelectMode): ResultAsync<Issue | null, Error> {
    return this.listIssues().andThen((issues) => {
      const lockChecks = issues.map((issue) =>
        this.isLocked(issue.id).map((locked) => ({ issue, locked }))
      );
      return ResultAsync.combine(lockChecks).map((entries) => {
        const available = entries.filter(({ locked }) => !locked).map(({ issue }) => issue);
        for (const priority of AUTO_SELECT_PRIORITY[mode]) {
          const match = available.find((i) => i.state === priority);
          if (match) return match;
        }
        return null;
      });
    });
  }

  checkAcceptanceCriteria(id: string): ResultAsync<boolean, Error> {
    return this.fetchIssue(id).map((issue) => parseAcceptanceCriteria(issue.body));
  }
}
