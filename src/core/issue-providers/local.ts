import { ResultAsync } from 'neverthrow';
import { IssueProvider } from './base.js';
import type { Issue, IssueState } from '../../types/index.js';
import { parseIssue, serializeIssue } from '../issue.js';
import {
  readFileSync, writeFileSync, readdirSync, renameSync,
  mkdirSync, existsSync, rmSync
} from 'fs';
import { join } from 'path';

export class LocalIssueProvider extends IssueProvider {
  constructor(private issuesDir: string) { super(); }

  private issuePath(id: string): string {
    const working = join(this.issuesDir, `${id}.md.working`);
    return existsSync(working) ? working : join(this.issuesDir, `${id}.md`);
  }

  private lockDir(id: string): string {
    return join(this.issuesDir, '.locks', id);
  }

  fetchIssue(id: string): ResultAsync<Issue, Error> {
    return ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const content = readFileSync(this.issuePath(id), 'utf8');
        return parseIssue(content).match(
          (issue) => issue,
          (e) => { throw e; }
        );
      }),
      (e) => e instanceof Error ? e : new Error(String(e))
    );
  }

  listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error> {
    return ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const entries = readdirSync(this.issuesDir);
        const seen = new Set<string>();
        const issues: Issue[] = [];
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          if (!entry.endsWith('.md') && !entry.endsWith('.md.working')) continue;
          const id = entry.replace(/\.md(\.working)?$/, '');
          if (seen.has(id)) continue;
          seen.add(id);
          try {
            const content = readFileSync(this.issuePath(id), 'utf8');
            const result = parseIssue(content);
            if (result.isOk()) {
              const issue = result.value;
              if (!filter?.state || issue.state === filter.state) issues.push(issue);
            }
          } catch { /* skip unreadable files */ }
        }
        return issues;
      }),
      (e) => e instanceof Error ? e : new Error(String(e))
    );
  }

  createIssue(input: { title: string; body?: string; parent?: string }): ResultAsync<Issue, Error> {
    return this.listIssues().andThen((existing) => {
      const maxId = existing
        .map((i) => parseInt(i.id.split('-')[0], 10))
        .reduce((a, b) => Math.max(a, b), 0);
      const id = String(maxId + 1).padStart(3, '0');
      const issue: Issue = {
        id, title: input.title, state: 'NEW',
        parent: input.parent ?? '', children: [],
        split_count: 0, body: input.body ?? '',
      };
      return ResultAsync.fromPromise(
        Promise.resolve().then(() => {
          writeFileSync(join(this.issuesDir, `${id}.md`), serializeIssue(issue));
          return issue;
        }),
        (e) => e instanceof Error ? e : new Error(String(e))
      );
    });
  }

  writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): ResultAsync<Issue, Error> {
    return this.fetchIssue(id).andThen((current) =>
      ResultAsync.fromPromise(
        Promise.resolve().then(() => {
          const updated = { ...current, ...fields };
          const target = this.issuePath(id);
          const tmp = `${target}.tmp`;
          writeFileSync(tmp, serializeIssue(updated));
          renameSync(tmp, target);
          return updated;
        }),
        (e) => e instanceof Error ? e : new Error(String(e))
      )
    );
  }

  deleteIssue(id: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      Promise.resolve().then(() => { rmSync(this.issuePath(id), { force: true }); }),
      (e) => e instanceof Error ? e : new Error(String(e))
    );
  }

  lockIssue(id: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        mkdirSync(join(this.issuesDir, '.locks'), { recursive: true }); // ensure parent exists
        mkdirSync(this.lockDir(id), { recursive: false }); // atomic: throws if already locked
        const issuePath = join(this.issuesDir, `${id}.md`);
        const workingPath = join(this.issuesDir, `${id}.md.working`);
        if (existsSync(issuePath)) renameSync(issuePath, workingPath);
      }),
      (e) => e instanceof Error ? e : new Error(String(e))
    );
  }

  unlockIssue(id: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const workingPath = join(this.issuesDir, `${id}.md.working`);
        const issuePath = join(this.issuesDir, `${id}.md`);
        if (existsSync(workingPath)) renameSync(workingPath, issuePath);
        rmSync(this.lockDir(id), { recursive: true, force: true });
      }),
      (e) => e instanceof Error ? e : new Error(String(e))
    );
  }

  isLocked(id: string): ResultAsync<boolean, Error> {
    return ResultAsync.fromSafePromise(
      Promise.resolve(
        existsSync(this.lockDir(id)) || existsSync(join(this.issuesDir, `${id}.md.working`))
      )
    );
  }
}
