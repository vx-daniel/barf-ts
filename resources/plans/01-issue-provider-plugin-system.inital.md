# Issue Provider Plugin System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all issue I/O behind an abstract `IssueProvider` class, ship `LocalIssueProvider` (file-based, current approach) and `GitHubIssueProvider` (GitHub REST API via `gh`), configured per project in `.barfrc`.

**Architecture:** Abstract base class `IssueProvider` in `src/core/issue-providers/base.ts` holds shared logic (state transition validation, auto-selection priority, acceptance criteria checking). Two concrete subclasses handle I/O: `local` uses POSIX `mkdir` locking + atomic tmpfile renames on markdown frontmatter; `github` calls the GitHub REST API via `execFileNoThrow('gh', [...])`, using labels for state, milestones for grouping, and native sub-issues for parent-child relationships. Provider constructed once in `src/index.ts` and injected into all commands — no globals, no re-construction.

**Tech Stack:** Bun, TypeScript strict mode, commander, `bun test` (built-in), `gh` CLI for GitHub operations, `execFileNoThrow` for all subprocess calls (prevents shell injection).

**Note:** This is a greenfield project — no `src/` files exist yet. All files are created from scratch.

**Design doc:** `docs/plans/async-watching-kazoo.md`

**Out of scope (future):** `barf migrate --from=local --to=github` (noted for v2.2), `context.ts`/`claude.ts`/`batch.ts`/`plan.ts`/`build.ts` (covered by 00-PLAN.md v2.0 tasks).

---

### Task 1: Project setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `bunfig.toml`

**Step 1: Create package.json**
```json
{
  "name": "barf",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "test": "bun test",
    "build": "bun build --compile --outfile=dist/barf src/index.ts"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

**Step 2: Install dependencies**

Run: `bun install`
Expected: `node_modules/` created, no errors

**Step 3: Create tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

**Step 4: Create bunfig.toml**
```toml
[test]
coverage = true
```

**Step 5: Initialize git and commit**
```bash
git init
git add package.json tsconfig.json bunfig.toml bun.lock
git commit -m "chore: project setup — bun, typescript, commander"
```

---

### Task 2: Types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Write types**
```typescript
// src/types/index.ts

export type IssueState =
  | 'NEW'
  | 'PLANNED'
  | 'PLANNED'
  | 'STUCK'
  | 'SPLIT'
  | 'BUILT';

export interface Issue {
  id: string;            // e.g. "001", "001-1"
  title: string;
  state: IssueState;
  parent: string;        // empty string = root issue
  children: string[];    // [] = leaf issue
  split_count: number;
  body: string;          // full markdown body after frontmatter
}

export interface CreateIssueInput {
  title: string;
  body?: string;
  parent?: string;
}

export type ClaudeEvent =
  | { type: 'usage'; tokens: number }
  | { type: 'tool'; name: string };

export interface Config {
  issuesDir: string;
  planDir: string;
  contextUsagePercent: number;
  maxAutoSplits: number;
  maxIterations: number;
  claudeTimeout: number;
  testCommand: string;
  planModel: string;
  buildModel: string;
  splitModel: string;
  extendedContextModel: string;
  pushStrategy: 'iteration' | 'on_complete' | 'manual';
  issueProvider: 'local' | 'github';
  githubRepo: string;    // "owner/repo"
}

export class InvalidTransitionError extends Error {
  constructor(from: IssueState, to: IssueState) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
```

**Step 2: Verify TypeScript sees no errors**

Run: `bun tsc --noEmit`
Expected: No errors

**Step 3: Commit**
```bash
git add src/types/index.ts
git commit -m "feat: define Issue, Config, IssueState, ClaudeEvent types"
```

---

### Task 3: execFileNoThrow utility

**Files:**
- Create: `tests/unit/utils/execFileNoThrow.test.ts`
- Create: `src/utils/execFileNoThrow.ts`

**Step 1: Write failing tests**
```typescript
// tests/unit/utils/execFileNoThrow.test.ts
import { describe, it, expect } from 'bun:test';
import { execFileNoThrow } from '../../../src/utils/execFileNoThrow';

describe('execFileNoThrow', () => {
  it('returns stdout on success', async () => {
    const result = await execFileNoThrow('echo', ['hello']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.stderr).toBe('');
  });

  it('returns non-zero status on failure without throwing', async () => {
    const result = await execFileNoThrow('false', []);
    expect(result.status).not.toBe(0);
  });

  it('captures stderr', async () => {
    const result = await execFileNoThrow('sh', ['-c', 'echo err >&2; exit 1']);
    expect(result.stderr.trim()).toBe('err');
    expect(result.status).not.toBe(0);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/utils/execFileNoThrow.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/utils/execFileNoThrow.ts
import { spawn } from 'bun';

export interface ExecResult {
  stdout: string;
  stderr: string;
  status: number;
}

/**
 * Runs a subprocess without a shell, preventing injection attacks.
 * Never throws — errors are reported via status code and stderr.
 */
export async function execFileNoThrow(
  file: string,
  args: string[] = [],
): Promise<ExecResult> {
  const proc = spawn({
    cmd: [file, ...args],
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, status] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, status };
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/utils/execFileNoThrow.test.ts`
Expected: 3 tests pass

**Step 5: Commit**
```bash
git add src/utils/execFileNoThrow.ts tests/unit/utils/execFileNoThrow.test.ts
git commit -m "feat: execFileNoThrow — safe subprocess wrapper, no shell injection"
```

---

### Task 4: Config parser

**Files:**
- Create: `tests/unit/config.test.ts`
- Create: `src/core/config.ts`

**Step 1: Write failing tests**
```typescript
// tests/unit/config.test.ts
import { describe, it, expect } from 'bun:test';
import { parseBarfrc, defaultConfig } from '../../src/core/config';

describe('parseBarfrc', () => {
  it('returns defaults when content is empty', () => {
    const config = parseBarfrc('');
    expect(config.issuesDir).toBe('issues');
    expect(config.issueProvider).toBe('local');
    expect(config.githubRepo).toBe('');
  });

  it('parses ISSUE_PROVIDER=github and GITHUB_REPO', () => {
    const config = parseBarfrc('ISSUE_PROVIDER=github\nGITHUB_REPO=owner/repo\n');
    expect(config.issueProvider).toBe('github');
    expect(config.githubRepo).toBe('owner/repo');
  });

  it('ignores comments and blank lines', () => {
    const config = parseBarfrc('# comment\n\nISSUES_DIR=.barf/issues\n');
    expect(config.issuesDir).toBe('.barf/issues');
  });

  it('parses numeric fields correctly', () => {
    const rc = 'CONTEXT_USAGE_PERCENT=80\nMAX_AUTO_SPLITS=5\n';
    const config = parseBarfrc(rc);
    expect(config.contextUsagePercent).toBe(80);
    expect(config.maxAutoSplits).toBe(5);
  });

  it('parses model fields', () => {
    const config = parseBarfrc('PLAN_MODEL=claude-opus-4-6\nBUILD_MODEL=claude-sonnet-4-6\n');
    expect(config.planModel).toBe('claude-opus-4-6');
    expect(config.buildModel).toBe('claude-sonnet-4-6');
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/config.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/config.ts
import type { Config } from '../types/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export function defaultConfig(): Config {
  return {
    issuesDir: 'issues',
    planDir: 'plans',
    contextUsagePercent: 75,
    maxAutoSplits: 3,
    maxIterations: 0,
    claudeTimeout: 3600,
    testCommand: '',
    planModel: 'claude-opus-4-6',
    buildModel: 'claude-sonnet-4-6',
    splitModel: 'claude-sonnet-4-6',
    extendedContextModel: 'claude-opus-4-6',
    pushStrategy: 'iteration',
    issueProvider: 'local',
    githubRepo: '',
  };
}

export function parseBarfrc(content: string): Config {
  const config = defaultConfig();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    switch (key) {
      case 'ISSUES_DIR':              config.issuesDir = val; break;
      case 'PLAN_DIR':                config.planDir = val; break;
      case 'CONTEXT_USAGE_PERCENT':   config.contextUsagePercent = parseInt(val, 10); break;
      case 'MAX_AUTO_SPLITS':         config.maxAutoSplits = parseInt(val, 10); break;
      case 'MAX_ITERATIONS':          config.maxIterations = parseInt(val, 10); break;
      case 'CLAUDE_TIMEOUT':          config.claudeTimeout = parseInt(val, 10); break;
      case 'TEST_COMMAND':            config.testCommand = val; break;
      case 'PLAN_MODEL':              config.planModel = val; break;
      case 'BUILD_MODEL':             config.buildModel = val; break;
      case 'SPLIT_MODEL':             config.splitModel = val; break;
      case 'EXTENDED_CONTEXT_MODEL':  config.extendedContextModel = val; break;
      case 'PUSH_STRATEGY':           config.pushStrategy = val as Config['pushStrategy']; break;
      case 'ISSUE_PROVIDER':          config.issueProvider = val as Config['issueProvider']; break;
      case 'GITHUB_REPO':             config.githubRepo = val; break;
    }
  }
  return config;
}

export function loadConfig(projectDir: string = process.cwd()): Config {
  const rcPath = join(projectDir, '.barfrc');
  try {
    const content = readFileSync(rcPath, 'utf8');
    return parseBarfrc(content);
  } catch {
    return defaultConfig();
  }
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/config.test.ts`
Expected: 5 tests pass

**Step 5: Commit**
```bash
git add src/core/config.ts tests/unit/config.test.ts
git commit -m "feat: .barfrc parser with ISSUE_PROVIDER and GITHUB_REPO support"
```

---

### Task 5: Pure issue functions

**Files:**
- Create: `tests/unit/issue.test.ts`
- Create: `src/core/issue.ts`

**Step 1: Write failing tests**
```typescript
// tests/unit/issue.test.ts
import { describe, it, expect } from 'bun:test';
import { parseIssue, serializeIssue, validateTransition, parseAcceptanceCriteria } from '../../src/core/issue';
import { InvalidTransitionError } from '../../src/types/index';

const SAMPLE = `---
id=001
title=My Issue
state=NEW
parent=
children=
split_count=0
---

## Description
Hello world

## Acceptance Criteria
- [x] Done thing
- [ ] Not done thing
`;

describe('parseIssue', () => {
  it('parses all frontmatter fields', () => {
    const issue = parseIssue(SAMPLE);
    expect(issue.id).toBe('001');
    expect(issue.title).toBe('My Issue');
    expect(issue.state).toBe('NEW');
    expect(issue.parent).toBe('');
    expect(issue.children).toEqual([]);
    expect(issue.split_count).toBe(0);
  });

  it('parses children as array', () => {
    const issue = parseIssue(SAMPLE.replace('children=', 'children=001-1,001-2'));
    expect(issue.children).toEqual(['001-1', '001-2']);
  });

  it('preserves body content', () => {
    const issue = parseIssue(SAMPLE);
    expect(issue.body).toContain('## Description');
    expect(issue.body).toContain('Hello world');
  });
});

describe('serializeIssue / parseIssue round-trip', () => {
  it('round-trips without data loss', () => {
    const original = parseIssue(SAMPLE);
    const serialized = serializeIssue(original);
    const reparsed = parseIssue(serialized);
    expect(reparsed.id).toBe(original.id);
    expect(reparsed.state).toBe(original.state);
    expect(reparsed.children).toEqual(original.children);
  });
});

describe('validateTransition', () => {
  it('allows valid transition NEW → PLANNED', () => {
    expect(() => validateTransition('NEW', 'PLANNED')).not.toThrow();
  });

  it('throws InvalidTransitionError on invalid transition', () => {
    expect(() => validateTransition('NEW', 'BUILT')).toThrow(InvalidTransitionError);
  });

  it('throws on transition from terminal BUILT state', () => {
    expect(() => validateTransition('BUILT', 'PLANNED')).toThrow(InvalidTransitionError);
  });
});

describe('parseAcceptanceCriteria', () => {
  it('returns false when any criteria unchecked', () => {
    expect(parseAcceptanceCriteria(SAMPLE)).toBe(false);
  });

  it('returns true when all criteria checked', () => {
    const allDone = SAMPLE.replace('- [ ] Not done thing', '- [x] Not done thing');
    expect(parseAcceptanceCriteria(allDone)).toBe(true);
  });

  it('returns true when no Acceptance Criteria section exists', () => {
    expect(parseAcceptanceCriteria('no criteria here')).toBe(true);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/issue.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/issue.ts
import type { Issue, IssueState } from '../types/index.js';
import { InvalidTransitionError } from '../types/index.js';

export const VALID_TRANSITIONS: Record<IssueState, IssueState[]> = {
  NEW:         ['PLANNED'],
  PLANNED:     ['PLANNED', 'STUCK', 'SPLIT'],
  PLANNED: ['BUILT', 'STUCK', 'SPLIT'],
  STUCK:       ['PLANNED', 'SPLIT'],
  SPLIT:       [],
  BUILT:   [],
};

export function parseIssue(content: string): Issue {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Invalid issue format: missing frontmatter delimiters');
  const [, fm, body] = match;
  const fields: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const eq = line.indexOf('=');
    if (eq !== -1) fields[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return {
    id:          fields.id ?? '',
    title:       fields.title ?? '',
    state:       (fields.state ?? 'NEW') as IssueState,
    parent:      fields.parent ?? '',
    children:    fields.children ? fields.children.split(',').filter(Boolean) : [],
    split_count: parseInt(fields.split_count ?? '0', 10),
    body:        body.trim(),
  };
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

export function validateTransition(from: IssueState, to: IssueState): void {
  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function parseAcceptanceCriteria(content: string): boolean {
  const section = content.match(/## Acceptance Criteria\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!section) return true;
  return !section[1].includes('- [ ]');
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/issue.test.ts`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/core/issue.ts tests/unit/issue.test.ts
git commit -m "feat: pure issue functions — parse, serialize, validateTransition, parseAcceptanceCriteria"
```

---

### Task 6: IssueProvider abstract base class

**Files:**
- Create: `src/core/issue-providers/base.ts`

**Step 1: Write the abstract class**

No test file for this task — the base class is fully exercised by LocalIssueProvider tests in Task 7 (specifically `transition()` and `autoSelect()`).

```typescript
// src/core/issue-providers/base.ts
import type { Issue, IssueState } from '../../types/index.js';
import { validateTransition, parseAcceptanceCriteria } from '../issue.js';

export type AutoSelectMode = 'plan' | 'build';

const AUTO_SELECT_PRIORITY: Record<AutoSelectMode, IssueState[]> = {
  plan:  ['NEW'],
  build: ['PLANNED', 'PLANNED', 'NEW'],
};

export abstract class IssueProvider {
  // ── Abstract I/O — implemented differently per provider ──────────────────

  abstract fetchIssue(id: string): Promise<Issue>;
  abstract listIssues(filter?: { state?: IssueState }): Promise<Issue[]>;
  abstract createIssue(input: { title: string; body?: string; parent?: string }): Promise<Issue>;
  abstract writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): Promise<Issue>;
  abstract deleteIssue(id: string): Promise<void>;
  abstract lockIssue(id: string): Promise<void>;
  abstract unlockIssue(id: string): Promise<void>;
  abstract isLocked(id: string): Promise<boolean>;

  // ── Shared logic — lives once in the base, not duplicated ─────────────────

  async transition(id: string, to: IssueState): Promise<Issue> {
    const issue = await this.fetchIssue(id);
    validateTransition(issue.state, to);  // throws InvalidTransitionError on bad transition
    return this.writeIssue(id, { state: to });
  }

  async autoSelect(mode: AutoSelectMode): Promise<Issue | null> {
    const issues = await this.listIssues();
    const lockChecks = await Promise.all(
      issues.map(async (issue) => ({ issue, locked: await this.isLocked(issue.id) }))
    );
    const available = lockChecks.filter(({ locked }) => !locked).map(({ issue }) => issue);
    for (const priority of AUTO_SELECT_PRIORITY[mode]) {
      const match = available.find((i) => i.state === priority);
      if (match) return match;
    }
    return null;
  }

  async checkAcceptanceCriteria(id: string): Promise<boolean> {
    const issue = await this.fetchIssue(id);
    return parseAcceptanceCriteria(issue.body);
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `bun tsc --noEmit`
Expected: No errors

**Step 3: Commit**
```bash
git add src/core/issue-providers/base.ts
git commit -m "feat: IssueProvider abstract base class — shared transition/autoSelect/criteria logic"
```

---

### Task 7: LocalIssueProvider

**Files:**
- Create: `tests/unit/issue-providers/local.test.ts`
- Create: `src/core/issue-providers/local.ts`

**Step 1: Write failing tests**
```typescript
// tests/unit/issue-providers/local.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LocalIssueProvider } from '../../../src/core/issue-providers/local';

const ISSUE_001 = `---
id=001
title=First Issue
state=NEW
parent=
children=
split_count=0
---

## Description
Test issue

## Acceptance Criteria
- [x] Done
`;

let dir: string;
let provider: LocalIssueProvider;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'barf-test-'));
  mkdirSync(join(dir, 'issues'), { recursive: true });
  writeFileSync(join(dir, 'issues', '001.md'), ISSUE_001);
  provider = new LocalIssueProvider(join(dir, 'issues'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('LocalIssueProvider', () => {
  it('fetches an issue by id', async () => {
    const issue = await provider.fetchIssue('001');
    expect(issue.id).toBe('001');
    expect(issue.title).toBe('First Issue');
    expect(issue.state).toBe('NEW');
  });

  it('lists all issues', async () => {
    const issues = await provider.listIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('001');
  });

  it('filters by state', async () => {
    const news    = await provider.listIssues({ state: 'NEW' });
    const planned = await provider.listIssues({ state: 'PLANNED' });
    expect(news).toHaveLength(1);
    expect(planned).toHaveLength(0);
  });

  it('writes updated fields', async () => {
    await provider.writeIssue('001', { state: 'PLANNED' });
    const updated = await provider.fetchIssue('001');
    expect(updated.state).toBe('PLANNED');
  });

  it('creates a new issue with next sequential id', async () => {
    const issue = await provider.createIssue({ title: 'New Issue', body: '## Description\nHello' });
    expect(issue.id).toBe('002');
    expect(issue.state).toBe('NEW');
  });

  it('transition() validates and applies state change', async () => {
    const updated = await provider.transition('001', 'PLANNED');
    expect(updated.state).toBe('PLANNED');
  });

  it('transition() throws on invalid state change', async () => {
    await expect(provider.transition('001', 'BUILT')).rejects.toThrow('Invalid transition');
  });

  it('locks and unlocks an issue', async () => {
    expect(await provider.isLocked('001')).toBe(false);
    await provider.lockIssue('001');
    expect(await provider.isLocked('001')).toBe(true);
    await provider.unlockIssue('001');
    expect(await provider.isLocked('001')).toBe(false);
  });

  it('autoSelect() returns highest priority unlocked issue', async () => {
    const issue = await provider.autoSelect('plan');
    expect(issue?.id).toBe('001');
  });

  it('autoSelect() skips locked issues', async () => {
    await provider.lockIssue('001');
    const issue = await provider.autoSelect('plan');
    expect(issue).toBeNull();
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/issue-providers/local.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/issue-providers/local.ts
import { IssueProvider } from './base.js';
import type { Issue, IssueState } from '../../types/index.js';
import { parseIssue, serializeIssue } from '../issue.js';
import {
  readFileSync, writeFileSync, readdirSync, renameSync,
  mkdirSync, existsSync, rmSync
} from 'fs';
import { join } from 'path';

export class LocalIssueProvider extends IssueProvider {
  constructor(private issuesDir: string) {
    super();
  }

  private issuePath(id: string): string {
    const working = join(this.issuesDir, `${id}.md.working`);
    if (existsSync(working)) return working;
    return join(this.issuesDir, `${id}.md`);
  }

  private lockDir(id: string): string {
    return join(this.issuesDir, '.locks', id);
  }

  async fetchIssue(id: string): Promise<Issue> {
    const content = readFileSync(this.issuePath(id), 'utf8');
    return parseIssue(content);
  }

  async listIssues(filter?: { state?: IssueState }): Promise<Issue[]> {
    const entries = readdirSync(this.issuesDir);
    const issues: Issue[] = [];
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      if (!entry.endsWith('.md') && !entry.endsWith('.md.working')) continue;
      const id = entry.replace(/\.md(\.working)?$/, '');
      try {
        const issue = await this.fetchIssue(id);
        if (!filter?.state || issue.state === filter.state) issues.push(issue);
      } catch { /* skip malformed files */ }
    }
    return issues;
  }

  async createIssue(input: { title: string; body?: string; parent?: string }): Promise<Issue> {
    const existing = await this.listIssues();
    const maxId = existing
      .map((i) => parseInt(i.id.split('-')[0], 10))
      .reduce((a, b) => Math.max(a, b), 0);
    const id = String(maxId + 1).padStart(3, '0');
    const issue: Issue = {
      id,
      title: input.title,
      state: 'NEW',
      parent: input.parent ?? '',
      children: [],
      split_count: 0,
      body: input.body ?? '',
    };
    writeFileSync(join(this.issuesDir, `${id}.md`), serializeIssue(issue));
    return issue;
  }

  async writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): Promise<Issue> {
    const current = await this.fetchIssue(id);
    const updated = { ...current, ...fields };
    const target = this.issuePath(id);
    const tmp = `${target}.tmp`;
    writeFileSync(tmp, serializeIssue(updated));
    renameSync(tmp, target);  // atomic on POSIX
    return updated;
  }

  async deleteIssue(id: string): Promise<void> {
    rmSync(this.issuePath(id), { force: true });
  }

  async lockIssue(id: string): Promise<void> {
    mkdirSync(this.lockDir(id), { recursive: false });  // atomic on POSIX; throws EEXIST if already locked
    const issuePath = join(this.issuesDir, `${id}.md`);
    const workingPath = join(this.issuesDir, `${id}.md.working`);
    if (existsSync(issuePath)) renameSync(issuePath, workingPath);
  }

  async unlockIssue(id: string): Promise<void> {
    const workingPath = join(this.issuesDir, `${id}.md.working`);
    const issuePath = join(this.issuesDir, `${id}.md`);
    if (existsSync(workingPath)) renameSync(workingPath, issuePath);
    rmSync(this.lockDir(id), { recursive: true, force: true });
  }

  async isLocked(id: string): Promise<boolean> {
    return existsSync(this.lockDir(id)) || existsSync(join(this.issuesDir, `${id}.md.working`));
  }
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/issue-providers/local.test.ts`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/core/issue-providers/local.ts tests/unit/issue-providers/local.test.ts
git commit -m "feat: LocalIssueProvider — POSIX mkdir locking, atomic tmpfile writes, frontmatter"
```

---

### Task 8: GitHubIssueProvider

**Files:**
- Create: `tests/unit/issue-providers/github.test.ts`
- Create: `src/core/issue-providers/github.ts`

**Step 1: Write failing tests**
```typescript
// tests/unit/issue-providers/github.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock execFileNoThrow before importing the provider
const mockExec = mock(() => Promise.resolve({ stdout: '', stderr: '', status: 0 }));
mock.module('../../../src/utils/execFileNoThrow', () => ({ execFileNoThrow: mockExec }));

import { GitHubIssueProvider } from '../../../src/core/issue-providers/github';

const GH_ISSUE_NEW = {
  number: 1,
  title: 'First Issue',
  body: '## Description\nTest issue',
  state: 'open',
  labels: [{ name: 'barf:new' }],
  milestone: null,
};

const GH_ISSUE_LOCKED = {
  ...GH_ISSUE_NEW,
  labels: [{ name: 'barf:new' }, { name: 'barf:locked' }],
};

describe('GitHubIssueProvider', () => {
  let provider: GitHubIssueProvider;

  beforeEach(() => {
    mockExec.mockClear();
    // First call in constructor: gh auth token
    mockExec.mockResolvedValueOnce({ stdout: 'ghp_faketoken\n', stderr: '', status: 0 });
    provider = new GitHubIssueProvider('owner/repo');
  });

  it('maps GitHub issue labels to IssueState', async () => {
    mockExec.mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_NEW), stderr: '', status: 0 });
    const issue = await provider.fetchIssue('1');
    expect(issue.id).toBe('1');
    expect(issue.title).toBe('First Issue');
    expect(issue.state).toBe('NEW');
  });

  it('maps closed GitHub issue to BUILT', async () => {
    const closed = { ...GH_ISSUE_NEW, state: 'closed', labels: [{ name: 'barf:complete' }] };
    mockExec.mockResolvedValueOnce({ stdout: JSON.stringify(closed), stderr: '', status: 0 });
    const issue = await provider.fetchIssue('1');
    expect(issue.state).toBe('BUILT');
  });

  it('lists issues', async () => {
    mockExec.mockResolvedValueOnce({ stdout: JSON.stringify([GH_ISSUE_NEW]), stderr: '', status: 0 });
    const issues = await provider.listIssues();
    expect(issues).toHaveLength(1);
    expect(issues[0].state).toBe('NEW');
  });

  it('isLocked returns true when barf:locked label present', async () => {
    mockExec.mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_LOCKED), stderr: '', status: 0 });
    expect(await provider.isLocked('1')).toBe(true);
  });

  it('isLocked returns false without barf:locked label', async () => {
    mockExec.mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_NEW), stderr: '', status: 0 });
    expect(await provider.isLocked('1')).toBe(false);
  });

  it('lockIssue calls gh api to add barf:locked label', async () => {
    mockExec.mockResolvedValueOnce({ stdout: '{}', stderr: '', status: 0 });
    await provider.lockIssue('1');
    expect(mockExec).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['api', '--method', 'POST'])
    );
  });

  it('deleteIssue throws — GitHub does not support issue deletion', async () => {
    await expect(provider.deleteIssue('1')).rejects.toThrow('GitHub Issues cannot be deleted');
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/issue-providers/github.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/issue-providers/github.ts
import { IssueProvider } from './base.js';
import type { Issue, IssueState } from '../../types/index.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';

const STATE_TO_LABEL: Record<IssueState, string> = {
  NEW:         'barf:new',
  PLANNED:     'barf:planned',
  PLANNED: 'barf:built',
  STUCK:       'barf:stuck',
  SPLIT:       'barf:split',
  BUILT:   'barf:complete',
};

const LABEL_TO_STATE: Record<string, IssueState> = Object.fromEntries(
  (Object.entries(STATE_TO_LABEL) as [IssueState, string][]).map(([state, label]) => [label, state])
);

interface GHIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: { name: string }[];
  milestone: { number: number; title: string } | null;
}

function ghToIssue(gh: GHIssue): Issue {
  const stateLabel = gh.labels.find((l) => LABEL_TO_STATE[l.name]);
  const state: IssueState =
    gh.state === 'closed' ? 'BUILT'
    : stateLabel ? LABEL_TO_STATE[stateLabel.name]
    : 'NEW';
  return {
    id:          String(gh.number),
    title:       gh.title,
    state,
    parent:      '',          // fetched separately via sub-issues API if needed
    children:    [],          // fetched separately via sub-issues API if needed
    split_count: 0,
    body:        gh.body ?? '',
  };
}

export class GitHubIssueProvider extends IssueProvider {
  private token: string = '';

  constructor(private repo: string) {
    super();
  }

  private async ensureAuth(): Promise<void> {
    if (this.token) return;
    const result = await execFileNoThrow('gh', ['auth', 'token']);
    if (result.status !== 0) throw new Error(`gh not authenticated. Run: gh auth login\n${result.stderr}`);
    this.token = result.stdout.trim();
  }

  private async ghApi<T>(args: string[]): Promise<T> {
    await this.ensureAuth();
    const result = await execFileNoThrow('gh', ['api', ...args]);
    if (result.status !== 0) throw new Error(`gh api error: ${result.stderr}`);
    return JSON.parse(result.stdout) as T;
  }

  async fetchIssue(id: string): Promise<Issue> {
    const gh = await this.ghApi<GHIssue>([`/repos/${this.repo}/issues/${id}`]);
    return ghToIssue(gh);
  }

  async listIssues(filter?: { state?: IssueState }): Promise<Issue[]> {
    const labelParam = filter?.state ? `&labels=${encodeURIComponent(STATE_TO_LABEL[filter.state])}` : '';
    const ghs = await this.ghApi<GHIssue[]>([`/repos/${this.repo}/issues?state=open&per_page=100${labelParam}`]);
    return ghs.map(ghToIssue);
  }

  async createIssue(input: { title: string; body?: string; parent?: string }): Promise<Issue> {
    await this.ensureAuth();
    const result = await execFileNoThrow('gh', [
      'api', '--method', 'POST', `/repos/${this.repo}/issues`,
      '-f', `title=${input.title}`,
      '-f', `body=${input.body ?? ''}`,
      '-f', 'labels[]=barf:new',
    ]);
    if (result.status !== 0) throw new Error(`Failed to create issue: ${result.stderr}`);
    return ghToIssue(JSON.parse(result.stdout) as GHIssue);
  }

  async writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): Promise<Issue> {
    await this.ensureAuth();
    if (fields.state) {
      const current = await this.fetchIssue(id);
      const oldLabel = STATE_TO_LABEL[current.state];
      const newLabel = STATE_TO_LABEL[fields.state];
      // Remove old state label
      await execFileNoThrow('gh', ['api', '--method', 'DELETE',
        `/repos/${this.repo}/issues/${id}/labels/${encodeURIComponent(oldLabel)}`]);
      // Add new state label
      await execFileNoThrow('gh', ['api', '--method', 'POST',
        `/repos/${this.repo}/issues/${id}/labels`,
        '-f', `labels[]=${newLabel}`]);
    }
    const patchArgs = ['api', '--method', 'PATCH', `/repos/${this.repo}/issues/${id}`];
    if (fields.title) patchArgs.push('-f', `title=${fields.title}`);
    if (fields.body !== undefined) patchArgs.push('-f', `body=${fields.body}`);
    if (fields.state === 'BUILT') patchArgs.push('-f', 'state=closed');
    const result = await execFileNoThrow('gh', patchArgs);
    if (result.status !== 0) throw new Error(`Failed to update issue: ${result.stderr}`);
    return ghToIssue(JSON.parse(result.stdout) as GHIssue);
  }

  async deleteIssue(_id: string): Promise<void> {
    throw new Error('GitHub Issues cannot be deleted via API. Transition to BUILT instead.');
  }

  async lockIssue(id: string): Promise<void> {
    await this.ensureAuth();
    await execFileNoThrow('gh', ['api', '--method', 'POST',
      `/repos/${this.repo}/issues/${id}/labels`,
      '-f', 'labels[]=barf:locked']);
  }

  async unlockIssue(id: string): Promise<void> {
    await this.ensureAuth();
    await execFileNoThrow('gh', ['api', '--method', 'DELETE',
      `/repos/${this.repo}/issues/${id}/labels/${encodeURIComponent('barf:locked')}`]);
  }

  async isLocked(id: string): Promise<boolean> {
    const gh = await this.ghApi<GHIssue>([`/repos/${this.repo}/issues/${id}`]);
    return gh.labels.some((l) => l.name === 'barf:locked');
  }
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/issue-providers/github.test.ts`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/core/issue-providers/github.ts tests/unit/issue-providers/github.test.ts
git commit -m "feat: GitHubIssueProvider — label-based state, gh auth delegation, sub-issues"
```

---

### Task 9: Provider factory

**Files:**
- Create: `tests/unit/issue-providers/factory.test.ts`
- Create: `src/core/issue-providers/factory.ts`

**Step 1: Write failing tests**
```typescript
// tests/unit/issue-providers/factory.test.ts
import { describe, it, expect } from 'bun:test';
import { createIssueProvider } from '../../../src/core/issue-providers/factory';
import { LocalIssueProvider } from '../../../src/core/issue-providers/local';
import { GitHubIssueProvider } from '../../../src/core/issue-providers/github';
import { defaultConfig } from '../../../src/core/config';

describe('createIssueProvider', () => {
  it('returns LocalIssueProvider by default', () => {
    const provider = createIssueProvider(defaultConfig());
    expect(provider).toBeInstanceOf(LocalIssueProvider);
  });

  it('returns GitHubIssueProvider when issueProvider=github', () => {
    const config = { ...defaultConfig(), issueProvider: 'github' as const, githubRepo: 'owner/repo' };
    const provider = createIssueProvider(config);
    expect(provider).toBeInstanceOf(GitHubIssueProvider);
  });

  it('throws when github provider is missing GITHUB_REPO', () => {
    const config = { ...defaultConfig(), issueProvider: 'github' as const, githubRepo: '' };
    expect(() => createIssueProvider(config)).toThrow('GITHUB_REPO required');
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/issue-providers/factory.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/issue-providers/factory.ts
import type { Config } from '../../types/index.js';
import { IssueProvider } from './base.js';
import { LocalIssueProvider } from './local.js';
import { GitHubIssueProvider } from './github.js';

export function createIssueProvider(config: Config): IssueProvider {
  switch (config.issueProvider) {
    case 'github':
      if (!config.githubRepo) throw new Error('GITHUB_REPO required when ISSUE_PROVIDER=github');
      return new GitHubIssueProvider(config.githubRepo);
    case 'local':
    default:
      return new LocalIssueProvider(config.issuesDir);
  }
}
```

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests pass across all files

**Step 5: Commit**
```bash
git add src/core/issue-providers/factory.ts tests/unit/issue-providers/factory.test.ts
git commit -m "feat: createIssueProvider factory — resolves local or github provider from config"
```

---

### Task 10: `barf init` command

**Files:**
- Create: `src/cli/commands/init.ts`

**Step 1: Implement**

```typescript
// src/cli/commands/init.ts
import type { IssueProvider } from '../../core/issue-providers/base.js';
import type { Config } from '../../types/index.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import { mkdirSync, writeFileSync, existsSync } from 'fs';

const BARF_LABELS = [
  { name: 'barf:new',         color: 'e4e669', description: 'Issue not yet planned' },
  { name: 'barf:planned',     color: 'bfd4f2', description: 'Issue planned, ready for build' },
  { name: 'barf:built', color: 'fef2c0', description: 'Issue being worked on by barf' },
  { name: 'barf:stuck',       color: 'e11d48', description: 'Issue blocked, needs intervention' },
  { name: 'barf:split',       color: 'c5def5', description: 'Issue split into child issues' },
  { name: 'barf:complete',   color: '0e8a16', description: 'Issue complete' },
  { name: 'barf:locked',      color: 'd93f0b', description: 'Issue currently being processed' },
];

export async function initCommand(_provider: IssueProvider, config: Config): Promise<void> {
  if (config.issueProvider === 'local') {
    mkdirSync(config.issuesDir, { recursive: true });
    mkdirSync(config.planDir, { recursive: true });
    console.log(`Created ${config.issuesDir}/ and ${config.planDir}/`);
  }

  if (config.issueProvider === 'github') {
    console.log(`Creating barf:* labels in ${config.githubRepo}...`);
    for (const label of BARF_LABELS) {
      const result = await execFileNoThrow('gh', [
        'api', '--method', 'POST',
        `/repos/${config.githubRepo}/labels`,
        '-f', `name=${label.name}`,
        '-f', `color=${label.color}`,
        '-f', `description=${label.description}`,
      ]);
      const alreadyExists = result.stderr.includes('already_exists') ||
                            result.stdout.includes('already_exists');
      if (result.status !== 0 && !alreadyExists) {
        console.error(`  ✗ ${label.name}: ${result.stderr.trim()}`);
      } else {
        console.log(`  ✓ ${label.name}`);
      }
    }
  }

  if (!existsSync('.barfrc')) {
    const lines = [
      `# barf configuration`,
      `ISSUE_PROVIDER=${config.issueProvider}`,
      config.issueProvider === 'github' ? `GITHUB_REPO=${config.githubRepo}` : '',
      `PLAN_MODEL=claude-opus-4-6`,
      `BUILD_MODEL=claude-sonnet-4-6`,
      `CONTEXT_USAGE_PERCENT=75`,
    ].filter(Boolean);
    writeFileSync('.barfrc', lines.join('\n') + '\n');
    console.log('Created .barfrc');
  }

  console.log('\nDone. Next: barf plan --issue=001');
}
```

**Step 2: Commit**
```bash
git add src/cli/commands/init.ts
git commit -m "feat: init command — creates dirs for local, creates barf:* labels for github"
```

---

### Task 11: `barf status` command and CLI entry point

**Files:**
- Create: `src/cli/commands/status.ts`
- Create: `src/index.ts`

**Step 1: Create status command**
```typescript
// src/cli/commands/status.ts
import type { IssueProvider } from '../../core/issue-providers/base.js';

export async function statusCommand(
  provider: IssueProvider,
  opts: { format: 'text' | 'json' }
): Promise<void> {
  const issues = await provider.listIssues();
  if (opts.format === 'json') {
    console.log(JSON.stringify(issues, null, 2));
    return;
  }
  if (issues.length === 0) {
    console.log('No issues found.');
    return;
  }
  for (const issue of issues) {
    const locked = await provider.isLocked(issue.id);
    const lockIndicator = locked ? ' 🔒' : '';
    console.log(`[${issue.state.padEnd(11)}] ${issue.id} — ${issue.title}${lockIndicator}`);
  }
}
```

**Step 2: Create CLI entry point**
```typescript
// src/index.ts
import { Command } from 'commander';
import { loadConfig } from './core/config.js';
import { createIssueProvider } from './core/issue-providers/factory.js';
import { initCommand } from './cli/commands/init.js';
import { statusCommand } from './cli/commands/status.js';

const program = new Command();
program.name('barf').description('AI issue orchestration CLI').version('2.0.0');

program
  .command('init')
  .description('Initialize barf in current project')
  .option('--provider <type>', 'Issue provider: local | github', 'local')
  .option('--repo <owner/repo>', 'GitHub repo (required when --provider=github)')
  .action(async (opts) => {
    const config = loadConfig();
    if (opts.provider) config.issueProvider = opts.provider;
    if (opts.repo) config.githubRepo = opts.repo;
    const issues = createIssueProvider(config);
    await initCommand(issues, config);
  });

program
  .command('status')
  .description('List all issues and their states')
  .option('--format <fmt>', 'Output format: text | json', 'text')
  .action(async (opts) => {
    const config = loadConfig();
    const issues = createIssueProvider(config);
    await statusCommand(issues, { format: opts.format });
  });

program.parseAsync(process.argv);
```

**Step 3: Build and smoke test**
```bash
bun build --compile --outfile=dist/barf src/index.ts
./dist/barf --help
./dist/barf status
```
Expected: Help output and status listing with no errors

**Step 4: Run all tests one final time**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/cli/commands/status.ts src/index.ts
git commit -m "feat: status command and CLI entry point — provider injected at startup"
```

---

### Task 12: Final verification

**Step 1: Full test suite**

Run: `bun test`
Expected: All tests pass, `>80%` coverage reported

**Step 2: Build binary**

Run: `bun build --compile --outfile=dist/barf src/index.ts`
Expected: `dist/barf` created, no TypeScript or bundler errors

**Step 3: Local provider end-to-end**
```bash
mkdir -p /tmp/barf-smoke && cd /tmp/barf-smoke
/path/to/dist/barf init
/path/to/dist/barf status        # should print: No issues found.
```

**Step 4: GitHub provider smoke test** _(requires `gh auth login`)_
```bash
ISSUE_PROVIDER=github GITHUB_REPO=owner/repo /path/to/dist/barf init
```
Expected: `barf:*` labels created in the GitHub repo

**Step 5: Commit build artifact if desired**
```bash
git add dist/barf
git commit -m "chore: include compiled barf binary"
```
