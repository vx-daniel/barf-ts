# Issue Provider Plugin System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all issue I/O behind an abstract `IssueProvider` class, ship `LocalIssueProvider` (file-based) and `GitHubIssueProvider` (GitHub REST API via `gh`), configured per project in `.barfrc`.

**Architecture:** Abstract base class `IssueProvider` in `src/core/issue-providers/base.ts` holds shared logic (state transition validation, auto-selection priority, acceptance criteria checking). Two concrete subclasses handle I/O: `local` uses POSIX `mkdir` locking + atomic tmpfile renames on markdown frontmatter; `github` calls the GitHub REST API via `execFileNoThrow('gh', [...])`, using labels for state, milestones for grouping, and native sub-issues for parent-child relationships. Provider constructed once in `src/index.ts` and injected into all commands — no globals, no re-construction.

**Tech Stack:** Bun, TypeScript strict mode, commander, `bun test` (built-in), `gh` CLI for GitHub operations, `execFileNoThrow` (shell-injection-safe subprocess), **Zod 4** for all schema definitions and runtime validation, **neverthrow** for `Result`/`ResultAsync` error types (no thrown exceptions in business logic), **Pino** for structured logging.

**Logging convention:**
- `src/utils/logger.ts` exports a singleton `logger` (Pino instance)
- Operational logs (state transitions, lock events, provider errors) → `logger.info/debug/error` → stderr
- User-facing command output (`barf status` listings, `barf init` confirmations) → `console.log` → stdout
- This keeps stdout pipe-safe (`barf status --format=json | jq`) while surfacing debug info on stderr

**Error handling contract:**
- All provider methods return `ResultAsync<T, Error>` — callers never need try/catch
- Pure functions (`validateTransition`, `parseIssue`) return `Result<T, E>`
- Zod parse errors surface as `Result<T, ZodError>` via `zodResult()` helper
- Only `src/index.ts` (CLI boundary) calls `.match()` to print errors and exit

**Note:** Greenfield project — no `src/` files exist yet.

**Design doc:** `docs/plans/01-issue-provider-plugin-system-design.md`

**Out of scope (future):** `barf migrate`, `context.ts`/`claude.ts`/`batch.ts`/`plan.ts`/`build.ts` (00-PLAN.md v2.0 tasks), inquirer.js interactive prompts.

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
    "ora": "^8.0.0",
    "zod": "^4.0.0",
    "neverthrow": "^8.0.0",
    "pino": "^9.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "pino-pretty": "^13.0.0"
  }
}
```

**Step 2: Install dependencies**

Run: `bun install`
Expected: `node_modules/` created, `zod` and `neverthrow` installed

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

**Step 4: Create `bunfig.toml`**
```toml
[test]
coverage = true
```

**Step 5: Initialize git and commit**
```bash
git init
git add package.json tsconfig.json bunfig.toml bun.lock
git commit -m "chore: project setup — bun, typescript, zod4, neverthrow, pino, commander"
```

---

### Task 2: Types (Zod schemas + inferred TypeScript types)

**Files:**
- Create: `src/types/index.ts`

Zod 4 is the source of truth. TypeScript types are derived from schemas — never defined separately.

**Step 1: Write schemas and types**
```typescript
// src/types/index.ts
import { z } from 'zod';

// ── Issue ─────────────────────────────────────────────────────────────────────

export const IssueStateSchema = z.enum([
  'NEW', 'PLANNED', 'IN_PROGRESS', 'STUCK', 'SPLIT', 'COMPLETED',
]);
export type IssueState = z.infer<typeof IssueStateSchema>;

export const IssueSchema = z.object({
  id:          z.string(),
  title:       z.string(),
  state:       IssueStateSchema,
  parent:      z.string(),
  children:    z.array(z.string()),
  split_count: z.number().int().nonnegative(),
  body:        z.string(),
});
export type Issue = z.infer<typeof IssueSchema>;

// ── Config ────────────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  issuesDir:             z.string().default('issues'),
  planDir:               z.string().default('plans'),
  contextUsagePercent:   z.number().int().default(75),
  maxAutoSplits:         z.number().int().default(3),
  maxIterations:         z.number().int().default(0),
  claudeTimeout:         z.number().int().default(3600),
  testCommand:           z.string().default(''),
  planModel:             z.string().default('claude-opus-4-6'),
  buildModel:            z.string().default('claude-sonnet-4-6'),
  splitModel:            z.string().default('claude-sonnet-4-6'),
  extendedContextModel:  z.string().default('claude-opus-4-6'),
  pushStrategy:          z.enum(['iteration', 'on_complete', 'manual']).default('iteration'),
  issueProvider:         z.enum(['local', 'github']).default('local'),
  githubRepo:            z.string().default(''),
});
export type Config = z.infer<typeof ConfigSchema>;

// ── Claude stream events ──────────────────────────────────────────────────────

export const ClaudeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('usage'), tokens: z.number() }),
  z.object({ type: z.literal('tool'), name: z.string() }),
]);
export type ClaudeEvent = z.infer<typeof ClaudeEventSchema>;

// ── Error types ───────────────────────────────────────────────────────────────

export class InvalidTransitionError extends Error {
  constructor(from: IssueState, to: IssueState) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class ProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ProviderError';
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `bun tsc --noEmit`
Expected: No errors

**Step 3: Commit**
```bash
git add src/types/index.ts
git commit -m "feat: Zod 4 schemas — IssueSchema, ConfigSchema, ClaudeEventSchema with inferred types"
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

  it('returns non-zero status without throwing', async () => {
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
 * Runs a subprocess without a shell — args are passed as an array, preventing
 * shell injection. Never throws; errors surface as non-zero status + stderr.
 */
export async function execFileNoThrow(
  file: string,
  args: string[] = [],
): Promise<ExecResult> {
  const proc = spawn({ cmd: [file, ...args], stdout: 'pipe', stderr: 'pipe' });
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
git commit -m "feat: execFileNoThrow — shell-injection-safe subprocess wrapper"
```

---

### Task 4: Logger utility

**Files:**
- Create: `tests/unit/utils/logger.test.ts`
- Create: `src/utils/logger.ts`

`pino-pretty` is a dev-only transport — in production (compiled binary) logs are JSON to stderr.
`LOG_LEVEL` env var overrides the default level at runtime.

**Step 1: Write failing tests**
```typescript
// tests/unit/utils/logger.test.ts
import { describe, it, expect } from 'bun:test';
import { createLogger } from '../../../src/utils/logger';

describe('createLogger', () => {
  it('creates a logger with the given name', () => {
    const log = createLogger('test');
    expect(log.bindings().name).toBe('test');
  });

  it('respects LOG_LEVEL env override', () => {
    process.env.LOG_LEVEL = 'warn';
    const log = createLogger('test');
    expect(log.level).toBe('warn');
    delete process.env.LOG_LEVEL;
  });

  it('defaults to info level', () => {
    delete process.env.LOG_LEVEL;
    const log = createLogger('test');
    expect(log.level).toBe('info');
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/utils/logger.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/utils/logger.ts
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Create a named child logger. Pass the module name so log lines are
 * attributable: createLogger('LocalIssueProvider').
 *
 * In dev: pretty-printed to stderr via pino-pretty.
 * In prod (compiled binary): structured JSON to stderr.
 */
export function createLogger(name: string): pino.Logger {
  return pino(
    {
      name,
      level: process.env.LOG_LEVEL ?? 'info',
    },
    isDev
      ? pino.transport({ target: 'pino-pretty', options: { colorize: true, destination: 2 } })
      : pino.destination(2), // stderr
  );
}

/** Root logger for src/index.ts and top-level use. */
export const logger = createLogger('barf');
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/utils/logger.test.ts`
Expected: 3 tests pass

**Step 5: Commit**
```bash
git add src/utils/logger.ts tests/unit/utils/logger.test.ts
git commit -m "feat: Pino logger — named child loggers, pino-pretty in dev, JSON in prod, stderr only"
```

---

### Task 5: Config parser

**Files:**
- Create: `tests/unit/config.test.ts`
- Create: `src/core/config.ts`

Parses KEY=VALUE `.barfrc` into a raw string map, then validates through `ConfigSchema` (Zod coerces numeric strings to numbers and applies defaults).

**Step 1: Write failing tests**
```typescript
// tests/unit/config.test.ts
import { describe, it, expect } from 'bun:test';
import { parseBarfrc, loadConfig } from '../../src/core/config';

describe('parseBarfrc', () => {
  it('returns defaults when content is empty', () => {
    const result = parseBarfrc('');
    expect(result.isOk()).toBe(true);
    const config = result._unsafeUnwrap();
    expect(config.issuesDir).toBe('issues');
    expect(config.issueProvider).toBe('local');
    expect(config.githubRepo).toBe('');
  });

  it('parses ISSUE_PROVIDER=github and GITHUB_REPO', () => {
    const result = parseBarfrc('ISSUE_PROVIDER=github\nGITHUB_REPO=owner/repo\n');
    const config = result._unsafeUnwrap();
    expect(config.issueProvider).toBe('github');
    expect(config.githubRepo).toBe('owner/repo');
  });

  it('ignores comments and blank lines', () => {
    const result = parseBarfrc('# comment\n\nISSUES_DIR=.barf/issues\n');
    expect(result._unsafeUnwrap().issuesDir).toBe('.barf/issues');
  });

  it('coerces numeric strings to numbers', () => {
    const result = parseBarfrc('CONTEXT_USAGE_PERCENT=80\nMAX_AUTO_SPLITS=5\n');
    const config = result._unsafeUnwrap();
    expect(config.contextUsagePercent).toBe(80);
    expect(config.maxAutoSplits).toBe(5);
  });

  it('returns Err on invalid ISSUE_PROVIDER value', () => {
    const result = parseBarfrc('ISSUE_PROVIDER=linear\n');
    expect(result.isErr()).toBe(true);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/config.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/config.ts
import { z } from 'zod';
import { Result, ok, err } from 'neverthrow';
import { ConfigSchema, type Config } from '../types/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Zod schema that coerces string values (all .barfrc values are strings)
const RawConfigSchema = ConfigSchema.extend({
  contextUsagePercent:  z.coerce.number().int().default(75),
  maxAutoSplits:        z.coerce.number().int().default(3),
  maxIterations:        z.coerce.number().int().default(0),
  claudeTimeout:        z.coerce.number().int().default(3600),
});

/** Parse a .barfrc KEY=VALUE string into a validated Config. */
export function parseBarfrc(content: string): Result<Config, z.ZodError> {
  const raw: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const KEY_MAP: Record<string, keyof Config> = {
      ISSUES_DIR:             'issuesDir',
      PLAN_DIR:               'planDir',
      CONTEXT_USAGE_PERCENT:  'contextUsagePercent',
      MAX_AUTO_SPLITS:        'maxAutoSplits',
      MAX_ITERATIONS:         'maxIterations',
      CLAUDE_TIMEOUT:         'claudeTimeout',
      TEST_COMMAND:           'testCommand',
      PLAN_MODEL:             'planModel',
      BUILD_MODEL:            'buildModel',
      SPLIT_MODEL:            'splitModel',
      EXTENDED_CONTEXT_MODEL: 'extendedContextModel',
      PUSH_STRATEGY:          'pushStrategy',
      ISSUE_PROVIDER:         'issueProvider',
      GITHUB_REPO:            'githubRepo',
    };
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    const mapped = KEY_MAP[key];
    if (mapped) raw[mapped] = val;
  }
  const parsed = RawConfigSchema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err(parsed.error);
}

export function loadConfig(projectDir: string = process.cwd()): Config {
  const rcPath = join(projectDir, '.barfrc');
  try {
    const content = readFileSync(rcPath, 'utf8');
    return parseBarfrc(content).match(
      (config) => config,
      () => RawConfigSchema.parse({}),
    );
  } catch {
    return RawConfigSchema.parse({});
  }
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/config.test.ts`
Expected: 5 tests pass

**Step 5: Commit**
```bash
git add src/core/config.ts tests/unit/config.test.ts
git commit -m "feat: .barfrc parser — Zod 4 coercion, Result return type, ISSUE_PROVIDER + GITHUB_REPO"
```

---

### Task 6: Pure issue functions

**Files:**
- Create: `tests/unit/issue.test.ts`
- Create: `src/core/issue.ts`

All functions return `Result` — no thrown exceptions.

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
    const result = parseIssue(SAMPLE);
    expect(result.isOk()).toBe(true);
    const issue = result._unsafeUnwrap();
    expect(issue.id).toBe('001');
    expect(issue.title).toBe('My Issue');
    expect(issue.state).toBe('NEW');
    expect(issue.parent).toBe('');
    expect(issue.children).toEqual([]);
    expect(issue.split_count).toBe(0);
  });

  it('parses children as array', () => {
    const issue = parseIssue(SAMPLE.replace('children=', 'children=001-1,001-2'))._unsafeUnwrap();
    expect(issue.children).toEqual(['001-1', '001-2']);
  });

  it('preserves body content', () => {
    const issue = parseIssue(SAMPLE)._unsafeUnwrap();
    expect(issue.body).toContain('## Description');
    expect(issue.body).toContain('Hello world');
  });

  it('returns Err on missing frontmatter', () => {
    expect(parseIssue('no frontmatter here').isErr()).toBe(true);
  });

  it('returns Err on invalid state value', () => {
    expect(parseIssue(SAMPLE.replace('state=NEW', 'state=BOGUS')).isErr()).toBe(true);
  });
});

describe('serializeIssue / parseIssue round-trip', () => {
  it('round-trips without data loss', () => {
    const original = parseIssue(SAMPLE)._unsafeUnwrap();
    const reparsed = parseIssue(serializeIssue(original))._unsafeUnwrap();
    expect(reparsed.id).toBe(original.id);
    expect(reparsed.state).toBe(original.state);
    expect(reparsed.children).toEqual(original.children);
  });
});

describe('validateTransition', () => {
  it('returns Ok for valid transition NEW → PLANNED', () => {
    expect(validateTransition('NEW', 'PLANNED').isOk()).toBe(true);
  });

  it('returns Err(InvalidTransitionError) for invalid transition', () => {
    const result = validateTransition('NEW', 'COMPLETED');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(InvalidTransitionError);
  });

  it('returns Err for transition from terminal COMPLETED state', () => {
    expect(validateTransition('COMPLETED', 'PLANNED').isErr()).toBe(true);
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
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/issue.test.ts`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/core/issue.ts tests/unit/issue.test.ts
git commit -m "feat: pure issue functions — Result types, Zod validation, no thrown exceptions"
```

---

### Task 7: IssueProvider abstract base class

**Files:**
- Create: `src/core/issue-providers/base.ts`

All abstract methods return `ResultAsync`. Shared logic (`transition`, `autoSelect`, `checkAcceptanceCriteria`) composes via neverthrow's `andThen`/`map` chains.

**Step 1: Create the abstract class**
```typescript
// src/core/issue-providers/base.ts
import { ResultAsync, okAsync } from 'neverthrow';
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
      if (validation.isErr()) return ResultAsync.fromSafePromise(Promise.resolve()).andThen(
        () => { return new ResultAsync(Promise.resolve(validation)); }
      );
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
```

**Step 2: Verify TypeScript compiles**

Run: `bun tsc --noEmit`
Expected: No errors

**Step 3: Commit**
```bash
git add src/core/issue-providers/base.ts
git commit -m "feat: IssueProvider abstract base — ResultAsync contract, shared transition/autoSelect/criteria"
```

---

### Task 8: LocalIssueProvider

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

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('LocalIssueProvider', () => {
  it('fetches an issue by id', async () => {
    const result = await provider.fetchIssue('001');
    expect(result.isOk()).toBe(true);
    const issue = result._unsafeUnwrap();
    expect(issue.id).toBe('001');
    expect(issue.state).toBe('NEW');
  });

  it('returns Err when issue file not found', async () => {
    const result = await provider.fetchIssue('999');
    expect(result.isErr()).toBe(true);
  });

  it('lists all issues', async () => {
    const result = await provider.listIssues();
    expect(result._unsafeUnwrap()).toHaveLength(1);
  });

  it('filters by state', async () => {
    const news    = (await provider.listIssues({ state: 'NEW' }))._unsafeUnwrap();
    const planned = (await provider.listIssues({ state: 'PLANNED' }))._unsafeUnwrap();
    expect(news).toHaveLength(1);
    expect(planned).toHaveLength(0);
  });

  it('writes updated fields atomically', async () => {
    await provider.writeIssue('001', { state: 'PLANNED' });
    const issue = (await provider.fetchIssue('001'))._unsafeUnwrap();
    expect(issue.state).toBe('PLANNED');
  });

  it('creates a new issue with next sequential id', async () => {
    const result = await provider.createIssue({ title: 'New Issue' });
    const issue = result._unsafeUnwrap();
    expect(issue.id).toBe('002');
    expect(issue.state).toBe('NEW');
  });

  it('transition() validates and applies state change', async () => {
    const result = await provider.transition('001', 'PLANNED');
    expect(result._unsafeUnwrap().state).toBe('PLANNED');
  });

  it('transition() returns Err on invalid state change', async () => {
    const result = await provider.transition('001', 'COMPLETED');
    expect(result.isErr()).toBe(true);
  });

  it('locks and unlocks an issue', async () => {
    expect((await provider.isLocked('001'))._unsafeUnwrap()).toBe(false);
    await provider.lockIssue('001');
    expect((await provider.isLocked('001'))._unsafeUnwrap()).toBe(true);
    await provider.unlockIssue('001');
    expect((await provider.isLocked('001'))._unsafeUnwrap()).toBe(false);
  });

  it('autoSelect returns highest priority unlocked issue', async () => {
    const result = await provider.autoSelect('plan');
    expect(result._unsafeUnwrap()?.id).toBe('001');
  });

  it('autoSelect returns null when all issues locked', async () => {
    await provider.lockIssue('001');
    const result = await provider.autoSelect('plan');
    expect(result._unsafeUnwrap()).toBeNull();
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/issue-providers/local.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/issue-providers/local.ts
import { ResultAsync, ok, err } from 'neverthrow';
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
      Promise.resolve().then(async () => {
        const entries = readdirSync(this.issuesDir);
        const issues: Issue[] = [];
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          if (!entry.endsWith('.md') && !entry.endsWith('.md.working')) continue;
          const id = entry.replace(/\.md(\.working)?$/, '');
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
        mkdirSync(this.lockDir(id), { recursive: false });
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
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/issue-providers/local.test.ts`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/core/issue-providers/local.ts tests/unit/issue-providers/local.test.ts
git commit -m "feat: LocalIssueProvider — ResultAsync, POSIX locking, atomic writes"
```

---

### Task 9: GitHubIssueProvider

**Files:**
- Create: `tests/unit/issue-providers/github.test.ts`
- Create: `src/core/issue-providers/github.ts`

**Step 1: Write failing tests**
```typescript
// tests/unit/issue-providers/github.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test';

const mockExec = mock(() => Promise.resolve({ stdout: '', stderr: '', status: 0 }));
mock.module('../../../src/utils/execFileNoThrow', () => ({ execFileNoThrow: mockExec }));

import { GitHubIssueProvider } from '../../../src/core/issue-providers/github';

const GH_ISSUE_NEW = {
  number: 1, title: 'First Issue',
  body: '## Description\nTest issue',
  state: 'open',
  labels: [{ name: 'barf:new' }],
  milestone: null,
};

describe('GitHubIssueProvider', () => {
  let provider: GitHubIssueProvider;

  beforeEach(() => {
    mockExec.mockClear();
    provider = new GitHubIssueProvider('owner/repo');
  });

  it('maps barf:new label to NEW state', async () => {
    mockExec
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 }) // auth
      .mockResolvedValueOnce({ stdout: JSON.stringify(GH_ISSUE_NEW), stderr: '', status: 0 });
    const result = await provider.fetchIssue('1');
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().state).toBe('NEW');
  });

  it('maps closed issue to COMPLETED', async () => {
    const closed = { ...GH_ISSUE_NEW, state: 'closed', labels: [{ name: 'barf:completed' }] };
    mockExec
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: JSON.stringify(closed), stderr: '', status: 0 });
    const result = await provider.fetchIssue('1');
    expect(result._unsafeUnwrap().state).toBe('COMPLETED');
  });

  it('returns Err when gh auth fails', async () => {
    mockExec.mockResolvedValueOnce({ stdout: '', stderr: 'not logged in', status: 1 });
    const result = await provider.fetchIssue('1');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('gh auth');
  });

  it('isLocked detects barf:locked label', async () => {
    const locked = { ...GH_ISSUE_NEW, labels: [{ name: 'barf:locked' }] };
    mockExec
      .mockResolvedValueOnce({ stdout: 'ghp_token\n', stderr: '', status: 0 })
      .mockResolvedValueOnce({ stdout: JSON.stringify(locked), stderr: '', status: 0 });
    expect((await provider.isLocked('1'))._unsafeUnwrap()).toBe(true);
  });

  it('deleteIssue returns Err — GitHub does not support deletion', async () => {
    const result = await provider.deleteIssue('1');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('cannot be deleted');
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/issue-providers/github.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/issue-providers/github.ts
import { z } from 'zod';
import { ResultAsync, ok, err } from 'neverthrow';
import { IssueProvider } from './base.js';
import type { Issue, IssueState } from '../../types/index.js';
import { execFileNoThrow } from '../../utils/execFileNoThrow.js';

const STATE_TO_LABEL: Record<IssueState, string> = {
  NEW: 'barf:new', PLANNED: 'barf:planned', IN_PROGRESS: 'barf:in-progress',
  STUCK: 'barf:stuck', SPLIT: 'barf:split', COMPLETED: 'barf:completed',
};
const LABEL_TO_STATE: Record<string, IssueState> = Object.fromEntries(
  (Object.entries(STATE_TO_LABEL) as [IssueState, string][]).map(([s, l]) => [l, s])
);

const GHIssueSchema = z.object({
  number:    z.number(),
  title:     z.string(),
  body:      z.string().nullable().transform((v) => v ?? ''),
  state:     z.enum(['open', 'closed']),
  labels:    z.array(z.object({ name: z.string() })),
  milestone: z.object({ number: z.number(), title: z.string() }).nullable(),
});
type GHIssue = z.infer<typeof GHIssueSchema>;

function ghToIssue(gh: GHIssue): Issue {
  const stateLabel = gh.labels.find((l) => LABEL_TO_STATE[l.name]);
  const state: IssueState =
    gh.state === 'closed' ? 'COMPLETED'
    : stateLabel ? LABEL_TO_STATE[stateLabel.name]
    : 'NEW';
  return {
    id: String(gh.number), title: gh.title, state,
    parent: '', children: [], split_count: 0, body: gh.body,
  };
}

export class GitHubIssueProvider extends IssueProvider {
  private token: string = '';

  constructor(private repo: string) { super(); }

  private ensureAuth(): ResultAsync<string, Error> {
    if (this.token) return ResultAsync.fromSafePromise(Promise.resolve(this.token));
    return ResultAsync.fromPromise(
      execFileNoThrow('gh', ['auth', 'token']),
      (e) => e instanceof Error ? e : new Error(String(e))
    ).andThen((result) => {
      if (result.status !== 0) return new ResultAsync(Promise.resolve(err(new Error(`gh not authenticated. Run: gh auth login\n${result.stderr}`))));
      this.token = result.stdout.trim();
      return new ResultAsync(Promise.resolve(ok(this.token)));
    });
  }

  private ghApi<T>(schema: z.ZodType<T>, args: string[]): ResultAsync<T, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        execFileNoThrow('gh', ['api', ...args]),
        (e) => e instanceof Error ? e : new Error(String(e))
      ).andThen((result) => {
        if (result.status !== 0) return new ResultAsync(Promise.resolve(err(new Error(`gh api error: ${result.stderr}`))));
        const parsed = schema.safeParse(JSON.parse(result.stdout));
        return new ResultAsync(Promise.resolve(parsed.success ? ok(parsed.data) : err(parsed.error)));
      })
    );
  }

  fetchIssue(id: string): ResultAsync<Issue, Error> {
    return this.ghApi(GHIssueSchema, [`/repos/${this.repo}/issues/${id}`]).map(ghToIssue);
  }

  listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error> {
    const labelParam = filter?.state ? `&labels=${encodeURIComponent(STATE_TO_LABEL[filter.state])}` : '';
    return this.ghApi(z.array(GHIssueSchema), [`/repos/${this.repo}/issues?state=open&per_page=100${labelParam}`])
      .map((ghs) => ghs.map(ghToIssue));
  }

  createIssue(input: { title: string; body?: string; parent?: string }): ResultAsync<Issue, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        execFileNoThrow('gh', [
          'api', '--method', 'POST', `/repos/${this.repo}/issues`,
          '-f', `title=${input.title}`,
          '-f', `body=${input.body ?? ''}`,
          '-f', 'labels[]=barf:new',
        ]),
        (e) => e instanceof Error ? e : new Error(String(e))
      ).andThen((result) => {
        if (result.status !== 0) return new ResultAsync(Promise.resolve(err(new Error(`Failed to create issue: ${result.stderr}`))));
        const parsed = GHIssueSchema.safeParse(JSON.parse(result.stdout));
        return new ResultAsync(Promise.resolve(parsed.success ? ok(ghToIssue(parsed.data)) : err(parsed.error)));
      })
    );
  }

  writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): ResultAsync<Issue, Error> {
    return this.fetchIssue(id).andThen((current) => {
      const steps: ResultAsync<unknown, Error>[] = [];
      if (fields.state && fields.state !== current.state) {
        const oldLabel = STATE_TO_LABEL[current.state];
        const newLabel = STATE_TO_LABEL[fields.state];
        steps.push(
          ResultAsync.fromPromise(
            execFileNoThrow('gh', ['api', '--method', 'DELETE',
              `/repos/${this.repo}/issues/${id}/labels/${encodeURIComponent(oldLabel)}`]),
            (e) => e instanceof Error ? e : new Error(String(e))
          ).andThen(() =>
            ResultAsync.fromPromise(
              execFileNoThrow('gh', ['api', '--method', 'POST',
                `/repos/${this.repo}/issues/${id}/labels`,
                '-f', `labels[]=${newLabel}`]),
              (e) => e instanceof Error ? e : new Error(String(e))
            )
          )
        );
      }
      const patchArgs = ['api', '--method', 'PATCH', `/repos/${this.repo}/issues/${id}`];
      if (fields.title) patchArgs.push('-f', `title=${fields.title}`);
      if (fields.body !== undefined) patchArgs.push('-f', `body=${fields.body}`);
      if (fields.state === 'COMPLETED') patchArgs.push('-f', 'state=closed');
      return ResultAsync.combine(steps).andThen(() =>
        this.ghApi(GHIssueSchema, patchArgs.slice(1)).map(ghToIssue)
      );
    });
  }

  deleteIssue(_id: string): ResultAsync<void, Error> {
    return new ResultAsync(Promise.resolve(err(
      new Error('GitHub Issues cannot be deleted via API. Transition to COMPLETED instead.')
    )));
  }

  lockIssue(id: string): ResultAsync<void, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        execFileNoThrow('gh', ['api', '--method', 'POST',
          `/repos/${this.repo}/issues/${id}/labels`,
          '-f', 'labels[]=barf:locked']),
        (e) => e instanceof Error ? e : new Error(String(e))
      ).map(() => undefined)
    );
  }

  unlockIssue(id: string): ResultAsync<void, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        execFileNoThrow('gh', ['api', '--method', 'DELETE',
          `/repos/${this.repo}/issues/${id}/labels/${encodeURIComponent('barf:locked')}`]),
        (e) => e instanceof Error ? e : new Error(String(e))
      ).map(() => undefined)
    );
  }

  isLocked(id: string): ResultAsync<boolean, Error> {
    return this.fetchIssue(id).andThen((issue) =>
      // Re-read raw GH issue to check current labels
      this.ghApi(GHIssueSchema, [`/repos/${this.repo}/issues/${issue.id}`])
        .map((gh) => gh.labels.some((l) => l.name === 'barf:locked'))
    );
  }
}
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/unit/issue-providers/github.test.ts`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/core/issue-providers/github.ts tests/unit/issue-providers/github.test.ts
git commit -m "feat: GitHubIssueProvider — ResultAsync, Zod-validated GH responses, label-based state"
```

---

### Task 10: Provider factory

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
import { ConfigSchema } from '../../../src/types/index';

const defaultConfig = () => ConfigSchema.parse({});

describe('createIssueProvider', () => {
  it('returns LocalIssueProvider by default', () => {
    const result = createIssueProvider(defaultConfig());
    expect(result._unsafeUnwrap()).toBeInstanceOf(LocalIssueProvider);
  });

  it('returns GitHubIssueProvider when issueProvider=github', () => {
    const config = ConfigSchema.parse({ issueProvider: 'github', githubRepo: 'owner/repo' });
    const result = createIssueProvider(config);
    expect(result._unsafeUnwrap()).toBeInstanceOf(GitHubIssueProvider);
  });

  it('returns Err when github is selected but GITHUB_REPO is missing', () => {
    const config = ConfigSchema.parse({ issueProvider: 'github' });
    const result = createIssueProvider(config);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain('GITHUB_REPO required');
  });
});
```

**Step 2: Run to verify failure**

Run: `bun test tests/unit/issue-providers/factory.test.ts`
Expected: FAIL — "Cannot find module"

**Step 3: Implement**
```typescript
// src/core/issue-providers/factory.ts
import { Result, ok, err } from 'neverthrow';
import type { Config } from '../../types/index.js';
import { IssueProvider } from './base.js';
import { LocalIssueProvider } from './local.js';
import { GitHubIssueProvider } from './github.js';

export function createIssueProvider(config: Config): Result<IssueProvider, Error> {
  switch (config.issueProvider) {
    case 'github':
      if (!config.githubRepo) return err(new Error('GITHUB_REPO required when ISSUE_PROVIDER=github'));
      return ok(new GitHubIssueProvider(config.githubRepo));
    case 'local':
    default:
      return ok(new LocalIssueProvider(config.issuesDir));
  }
}
```

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/core/issue-providers/factory.ts tests/unit/issue-providers/factory.test.ts
git commit -m "feat: createIssueProvider factory — Result return, resolves local or github from config"
```

---

### Task 11: `barf init` command

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
  { name: 'barf:in-progress', color: 'fef2c0', description: 'Issue being worked on by barf' },
  { name: 'barf:stuck',       color: 'e11d48', description: 'Issue blocked, needs intervention' },
  { name: 'barf:split',       color: 'c5def5', description: 'Issue split into child issues' },
  { name: 'barf:completed',   color: '0e8a16', description: 'Issue complete' },
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
        'api', '--method', 'POST', `/repos/${config.githubRepo}/labels`,
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
      '# barf configuration',
      `ISSUE_PROVIDER=${config.issueProvider}`,
      config.issueProvider === 'github' ? `GITHUB_REPO=${config.githubRepo}` : '',
      'PLAN_MODEL=claude-opus-4-6',
      'BUILD_MODEL=claude-sonnet-4-6',
      'CONTEXT_USAGE_PERCENT=75',
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
git commit -m "feat: init command — creates dirs (local) or barf:* labels (github)"
```

---

### Task 12: `barf status` command and CLI entry point

**Files:**
- Create: `src/cli/commands/status.ts`
- Create: `src/index.ts`

`src/index.ts` is the only place that calls `.match()` to convert Results into process exits.

**Step 1: Create status command**
```typescript
// src/cli/commands/status.ts
import type { IssueProvider } from '../../core/issue-providers/base.js';

export async function statusCommand(
  provider: IssueProvider,
  opts: { format: 'text' | 'json' },
): Promise<void> {
  const result = await provider.listIssues();
  if (result.isErr()) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }
  const issues = result.value;
  if (opts.format === 'json') {
    console.log(JSON.stringify(issues, null, 2));
    return;
  }
  if (issues.length === 0) {
    console.log('No issues found.');
    return;
  }
  for (const issue of issues) {
    console.log(`[${issue.state.padEnd(11)}] ${issue.id} — ${issue.title}`);
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

function getProvider(config: ReturnType<typeof loadConfig>) {
  return createIssueProvider(config).match(
    (p) => p,
    (e) => { console.error(`Error: ${e.message}`); process.exit(1); }
  );
}

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
    const issues = getProvider(config);
    await initCommand(issues, config);
  });

program
  .command('status')
  .description('List all issues and their states')
  .option('--format <fmt>', 'Output format: text | json', 'text')
  .action(async (opts) => {
    const config = loadConfig();
    const issues = getProvider(config);
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
Expected: Help output. Status prints "No issues found." (or existing issues if .barfrc present)

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**
```bash
git add src/cli/commands/status.ts src/index.ts
git commit -m "feat: status command and CLI entry point — Result errors surface at CLI boundary only"
```

---

### Task 13: Final verification

**Step 1: Full test suite with coverage**

Run: `bun test --coverage`
Expected: All tests pass, core modules at >80% coverage

**Step 2: TypeScript strict check**

Run: `bun tsc --noEmit`
Expected: Zero errors

**Step 3: Build binary**

Run: `bun build --compile --outfile=dist/barf src/index.ts`
Expected: `dist/barf` created, no errors

**Step 4: Local provider end-to-end**
```bash
mkdir -p /tmp/barf-smoke && cd /tmp/barf-smoke
/path/to/dist/barf init
/path/to/dist/barf status        # → No issues found.
```

**Step 5: GitHub provider smoke test** _(requires `gh auth login`)_
```bash
ISSUE_PROVIDER=github GITHUB_REPO=owner/repo /path/to/dist/barf init
```
Expected: All `barf:*` labels created in the GitHub repo

**Step 6: Commit**
```bash
git add -A
git commit -m "chore: verified — all tests pass, binary builds, smoke tests clean"
```
