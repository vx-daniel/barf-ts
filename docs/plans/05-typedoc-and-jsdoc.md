# TypeDoc + JSDoc Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add TypeDoc support and JSDoc comments to all public APIs so contributors can run `bun run docs` to generate browsable HTML documentation.

**Architecture:** TypeDoc reads TypeScript source directly using the project's `tsconfig.json`. All public types, classes, and functions get `/** */` JSDoc blocks. Private helpers (`private` methods, internal utilities) are excluded. The `docs/api/` output is git-ignored (generated artifact).

**Tech Stack:** TypeDoc 0.27+, TypeScript JSDoc syntax (`@param`, `@returns`, `@throws`, `@example`), Bun

---

### Task 1: Install TypeDoc and configure

**Files:**
- Modify: `package.json`
- Create: `typedoc.json`
- Modify: `.gitignore` (create if missing)

**Step 1: Install TypeDoc**

```bash
bun add -d typedoc
```

Expected: `typedoc` appears in `devDependencies` in `package.json`.

**Step 2: Create `typedoc.json`**

```json
{
  "entryPoints": ["src"],
  "entryPointStrategy": "expand",
  "out": "docs/api",
  "excludePrivate": true,
  "excludeInternal": true,
  "readme": "none",
  "validation": {
    "notExported": true,
    "invalidLink": true
  }
}
```

**Step 3: Add `docs` script to `package.json`**

In the `"scripts"` section, add:
```json
"docs": "typedoc"
```

The scripts section should read:
```json
"scripts": {
  "dev": "bun run src/index.ts",
  "test": "bun test",
  "build": "bun build --compile --outfile=dist/barf src/index.ts",
  "docs": "typedoc",
  "lint": "oxlint src/ tests/",
  "lint:fix": "oxlint --fix src/ tests/",
  "check": "bun run lint"
}
```

**Step 4: Add `docs/api/` to `.gitignore`**

Check if `.gitignore` exists:
```bash
ls .gitignore 2>/dev/null || echo "missing"
```

If missing, create it. Add this line (or append if it exists):
```
docs/api/
```

**Step 5: Verify TypeDoc runs (may warn about missing docs — that's fine)**

```bash
bun run docs
```

Expected: TypeDoc generates `docs/api/index.html` without hard errors (warnings about undocumented items are acceptable at this stage).

**Step 6: Verify TypeScript still compiles**

```bash
bun x tsc --noEmit
```

Expected: zero errors.

**Step 7: Commit**

```bash
git add package.json typedoc.json .gitignore bun.lockb
git commit -m "feat: add typedoc support (bun run docs)"
```

---

### Task 2: JSDoc for `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

No new tests — this is pure documentation. Verification: TypeScript still compiles and TypeDoc runs clean.

**Step 1: Add JSDoc to `IssueStateSchema` and `IssueState`**

Replace:
```typescript
export const IssueStateSchema = z.enum([
  'NEW', 'PLANNED', 'IN_PROGRESS', 'STUCK', 'SPLIT', 'COMPLETED',
]);
export type IssueState = z.infer<typeof IssueStateSchema>;
```

With:
```typescript
/**
 * All valid states an issue can occupy.
 *
 * ```
 * NEW → PLANNED → IN_PROGRESS → COMPLETED
 *          ↘           ↘
 *           STUCK ←→ SPLIT
 * ```
 *
 * Transitions are enforced by `validateTransition` — never mutate state directly.
 */
export const IssueStateSchema = z.enum([
  'NEW', 'PLANNED', 'IN_PROGRESS', 'STUCK', 'SPLIT', 'COMPLETED',
]);
/** A barf issue state. Derived from {@link IssueStateSchema}. */
export type IssueState = z.infer<typeof IssueStateSchema>;
```

**Step 2: Add JSDoc to `IssueSchema` and `Issue`**

Replace:
```typescript
export const IssueSchema = z.object({
```

With:
```typescript
/**
 * A barf work item. Stored as frontmatter markdown under `issuesDir`.
 *
 * The `body` field contains everything after the closing `---` delimiter.
 * `children` holds IDs of sub-issues created by a split operation.
 * `split_count` tracks how many times this issue has been split (used for overflow decisions).
 */
export const IssueSchema = z.object({
```

And below it:
```typescript
/** A validated barf work item. Derived from {@link IssueSchema}. */
export type Issue = z.infer<typeof IssueSchema>;
```

**Step 3: Add JSDoc to `ConfigSchema` and `Config`**

Replace:
```typescript
export const ConfigSchema = z.object({
```

With:
```typescript
/**
 * Runtime configuration for a barf project.
 *
 * Loaded from `.barfrc` (KEY=VALUE format) via `loadConfig`. Falls back to
 * these defaults when the file is absent or a key is missing.
 *
 * @see {@link loadConfig}
 * @see {@link parseBarfrc}
 */
export const ConfigSchema = z.object({
```

And below it:
```typescript
/** Validated barf runtime configuration. Derived from {@link ConfigSchema}. */
export type Config = z.infer<typeof ConfigSchema>;
```

**Step 4: Add JSDoc to `ClaudeEventSchema` and `ClaudeEvent`**

Replace:
```typescript
export const ClaudeEventSchema = z.discriminatedUnion('type', [
```

With:
```typescript
/**
 * A structured event emitted by the Claude stream parser.
 *
 * - `usage`: cumulative token count from the main conversation context
 * - `tool`: a tool invocation name from an assistant message
 *
 * @see {@link parseClaudeStream}
 */
export const ClaudeEventSchema = z.discriminatedUnion('type', [
```

And below it:
```typescript
/** A parsed Claude stream event. Derived from {@link ClaudeEventSchema}. */
export type ClaudeEvent = z.infer<typeof ClaudeEventSchema>;
```

**Step 5: Add JSDoc to error classes**

Replace:
```typescript
export class InvalidTransitionError extends Error {
  constructor(from: IssueState, to: IssueState) {
```

With:
```typescript
/** Thrown by `validateTransition` when a state change is not permitted. */
export class InvalidTransitionError extends Error {
  constructor(from: IssueState, to: IssueState) {
```

Replace:
```typescript
export class ProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
```

With:
```typescript
/** Wraps I/O errors from issue provider operations. */
export class ProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
```

**Step 6: Verify**

```bash
bun x tsc --noEmit
```

Expected: zero errors.

**Step 7: Commit**

```bash
git add src/types/index.ts
git commit -m "docs: JSDoc for types/index.ts"
```

---

### Task 3: JSDoc for `src/core/issue.ts` and `src/core/config.ts`

**Files:**
- Modify: `src/core/issue.ts`
- Modify: `src/core/config.ts`

**Step 1: Add JSDoc to `VALID_TRANSITIONS`**

Replace:
```typescript
export const VALID_TRANSITIONS: Record<IssueState, IssueState[]> = {
```

With:
```typescript
/**
 * The allowed state transitions in the barf issue lifecycle.
 *
 * Used by `validateTransition` to reject illegal moves.
 * Terminal states (`SPLIT`, `COMPLETED`) have empty arrays — no further transitions allowed.
 */
export const VALID_TRANSITIONS: Record<IssueState, IssueState[]> = {
```

**Step 2: Add JSDoc to `parseIssue`**

Replace:
```typescript
export function parseIssue(content: string): Result<Issue, z.ZodError | Error> {
```

With:
```typescript
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
 */
export function parseIssue(content: string): Result<Issue, z.ZodError | Error> {
```

**Step 3: Add JSDoc to `serializeIssue`**

Replace:
```typescript
export function serializeIssue(issue: Issue): string {
```

With:
```typescript
/**
 * Serializes an {@link Issue} to frontmatter markdown.
 * Round-trips cleanly with {@link parseIssue}.
 */
export function serializeIssue(issue: Issue): string {
```

**Step 4: Add JSDoc to `validateTransition`**

Replace:
```typescript
export function validateTransition(
  from: IssueState,
  to: IssueState,
): Result<void, InvalidTransitionError> {
```

With:
```typescript
/**
 * Validates a proposed state transition against {@link VALID_TRANSITIONS}.
 *
 * @returns `ok(undefined)` if the transition is permitted,
 *   `err(InvalidTransitionError)` if it is not.
 */
export function validateTransition(
  from: IssueState,
  to: IssueState,
): Result<void, InvalidTransitionError> {
```

**Step 5: Add JSDoc to `parseAcceptanceCriteria`**

Replace:
```typescript
export function parseAcceptanceCriteria(content: string): boolean {
```

With:
```typescript
/**
 * Returns `true` if all acceptance criteria checkboxes are checked.
 *
 * Scans the `## Acceptance Criteria` section for `- [ ]` unchecked items.
 * Returns `true` when none are found, or when the section is absent entirely.
 *
 * @param content - Raw issue body (the markdown text after the frontmatter `---`).
 */
export function parseAcceptanceCriteria(content: string): boolean {
```

**Step 6: Add JSDoc to `loadConfig` in `config.ts`**

Replace:
```typescript
export function loadConfig(projectDir: string = process.cwd()): Config {
```

With:
```typescript
/**
 * Loads barf configuration from `<projectDir>/.barfrc`.
 *
 * Falls back to schema defaults if the file is missing or cannot be parsed.
 * Never throws — invalid config is silently replaced with defaults.
 *
 * @param projectDir - Directory containing `.barfrc`. Defaults to `process.cwd()`.
 */
export function loadConfig(projectDir: string = process.cwd()): Config {
```

**Step 7: Verify**

```bash
bun x tsc --noEmit
```

Expected: zero errors.

**Step 8: Commit**

```bash
git add src/core/issue.ts src/core/config.ts
git commit -m "docs: JSDoc for issue.ts and config.ts"
```

---

### Task 4: JSDoc for `src/core/issue-providers/base.ts`

**Files:**
- Modify: `src/core/issue-providers/base.ts`

**Step 1: Add JSDoc to `AutoSelectMode` type and `AUTO_SELECT_PRIORITY`**

After the import block, before `export type AutoSelectMode`, add:

```typescript
/** Selects which priority queue to use when auto-picking an issue. */
export type AutoSelectMode = 'plan' | 'build';
```

Replace the existing `export type AutoSelectMode = 'plan' | 'build';` line.

**Step 2: Add JSDoc to the `IssueProvider` class**

Replace:
```typescript
export abstract class IssueProvider {
  // ── Abstract I/O — implemented per provider ───────────────────────────────
```

With:
```typescript
/**
 * Abstract base for all barf issue storage backends.
 *
 * Concrete implementations: {@link LocalIssueProvider}, {@link GitHubIssueProvider}.
 *
 * To add a custom backend: extend this class and implement the eight abstract methods.
 * The `transition`, `autoSelect`, and `checkAcceptanceCriteria` methods are
 * provided and shared by all providers.
 */
export abstract class IssueProvider {
  // ── Abstract I/O — implemented per provider ───────────────────────────────
```

**Step 3: Add JSDoc to each abstract method**

Replace the abstract method declarations with documented versions:

```typescript
  /** Retrieves a single issue by ID. Returns `err` if the issue does not exist. */
  abstract fetchIssue(id: string): ResultAsync<Issue, Error>;

  /**
   * Lists all issues, optionally filtered by state.
   * @param filter - Optional filter; if `state` is set, only matching issues are returned.
   */
  abstract listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error>;

  /**
   * Creates a new issue with state `NEW`.
   * @param input - Title is required; body and parent are optional.
   */
  abstract createIssue(input: { title: string; body?: string; parent?: string }): ResultAsync<Issue, Error>;

  /**
   * Patches an issue's fields. Implementations should write atomically.
   * The `id` field cannot be patched — it is excluded from `fields`.
   */
  abstract writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): ResultAsync<Issue, Error>;

  /**
   * Permanently deletes an issue.
   * GitHub provider returns `err` instead — use `transition(id, 'COMPLETED')` there.
   */
  abstract deleteIssue(id: string): ResultAsync<void, Error>;

  /**
   * Acquires an exclusive lock on the issue.
   *
   * - LocalIssueProvider: uses `mkdir` atomicity + renames `.md` → `.md.working`
   * - GitHubIssueProvider: adds the `barf:locked` label
   *
   * Returns `err` if the issue is already locked.
   */
  abstract lockIssue(id: string): ResultAsync<void, Error>;

  /** Releases the lock acquired by {@link lockIssue}. Safe to call if not locked. */
  abstract unlockIssue(id: string): ResultAsync<void, Error>;

  /** Returns `true` if the issue is currently locked by any process. */
  abstract isLocked(id: string): ResultAsync<boolean, Error>;
```

**Step 4: Add JSDoc to `transition`, `autoSelect`, `checkAcceptanceCriteria`**

Replace:
```typescript
  transition(id: string, to: IssueState): ResultAsync<Issue, Error> {
```

With:
```typescript
  /**
   * Validates and applies a state transition.
   *
   * Delegates validation to {@link validateTransition}; writes the new state via
   * {@link writeIssue}. Returns `err(InvalidTransitionError)` for illegal moves.
   */
  transition(id: string, to: IssueState): ResultAsync<Issue, Error> {
```

Replace:
```typescript
  autoSelect(mode: AutoSelectMode): ResultAsync<Issue | null, Error> {
```

With:
```typescript
  /**
   * Selects the highest-priority available (unlocked) issue for the given mode.
   *
   * Priority order:
   * - `plan`: NEW
   * - `build`: IN_PROGRESS → PLANNED → NEW
   *
   * Returns `null` if no eligible (matching state + unlocked) issue exists.
   */
  autoSelect(mode: AutoSelectMode): ResultAsync<Issue | null, Error> {
```

Replace:
```typescript
  checkAcceptanceCriteria(id: string): ResultAsync<boolean, Error> {
```

With:
```typescript
  /**
   * Returns `true` if all acceptance criteria checkboxes in the issue body are ticked.
   * Delegates to {@link parseAcceptanceCriteria}.
   */
  checkAcceptanceCriteria(id: string): ResultAsync<boolean, Error> {
```

**Step 5: Verify**

```bash
bun x tsc --noEmit
```

Expected: zero errors.

**Step 6: Commit**

```bash
git add src/core/issue-providers/base.ts
git commit -m "docs: JSDoc for IssueProvider base class"
```

---

### Task 5: JSDoc for `src/core/issue-providers/local.ts` and `factory.ts`

**Files:**
- Modify: `src/core/issue-providers/local.ts`
- Modify: `src/core/issue-providers/factory.ts`

**Step 1: Add JSDoc to `LocalIssueProvider` class**

Replace:
```typescript
export class LocalIssueProvider extends IssueProvider {
  constructor(private issuesDir: string) { super(); }
```

With:
```typescript
/**
 * File-system issue provider. Stores issues as frontmatter markdown files under `issuesDir`.
 *
 * **Locking:** Uses POSIX `mkdir` atomicity — `mkdir .locks/<id>` succeeds for exactly
 * one concurrent caller. The locked issue file is renamed to `<id>.md.working` to signal
 * in-progress state. Both the lock directory and `.working` file are restored by `unlockIssue`.
 *
 * **Writes:** All writes are atomic — data is written to `<file>.tmp` then `rename`d to
 * the target, preventing partial reads.
 */
export class LocalIssueProvider extends IssueProvider {
  constructor(private issuesDir: string) { super(); }
```

**Step 2: Add JSDoc to `createIssueProvider` in `factory.ts`**

Replace:
```typescript
export function createIssueProvider(config: Config): Result<IssueProvider, Error> {
```

With:
```typescript
/**
 * Instantiates the issue provider selected in `config.issueProvider`.
 *
 * @returns `err` if `issueProvider` is `'github'` and `githubRepo` is not set.
 */
export function createIssueProvider(config: Config): Result<IssueProvider, Error> {
```

**Step 3: Verify**

```bash
bun x tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
git add src/core/issue-providers/local.ts src/core/issue-providers/factory.ts
git commit -m "docs: JSDoc for LocalIssueProvider and factory"
```

---

### Task 6: JSDoc for `src/core/issue-providers/github.ts`

**Files:**
- Modify: `src/core/issue-providers/github.ts`

**Step 1: Add JSDoc to `GitHubIssueProvider` class**

Replace:
```typescript
export class GitHubIssueProvider extends IssueProvider {
  private token: string = '';
  private spawnFile: SpawnFn;

  constructor(private repo: string, spawnFn?: SpawnFn) {
    super();
    this.spawnFile = spawnFn ?? execFileNoThrow;
  }
```

With:
```typescript
/**
 * GitHub Issues provider. Maps the barf state machine to GitHub labels (`barf:*`).
 *
 * **Prerequisites:** The `gh` CLI must be authenticated (`gh auth login`).
 *
 * **Locking:** Uses a `barf:locked` label — not POSIX-atomic. Designed for
 * single-agent use; concurrent agents on the same repo may race.
 *
 * **Deletion:** GitHub issues cannot be deleted via the API. `deleteIssue` returns
 * `err` — transition to `COMPLETED` instead.
 *
 * **Testing:** Pass a `spawnFn` to inject a mock `gh` implementation in tests.
 * This avoids real network calls without `mock.module` process-global patching.
 */
export class GitHubIssueProvider extends IssueProvider {
  private token: string = '';
  private spawnFile: SpawnFn;

  constructor(private repo: string, spawnFn?: SpawnFn) {
    super();
    this.spawnFile = spawnFn ?? execFileNoThrow;
  }
```

**Step 2: Verify**

```bash
bun x tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add src/core/issue-providers/github.ts
git commit -m "docs: JSDoc for GitHubIssueProvider"
```

---

### Task 7: JSDoc for `src/core/batch.ts` (remaining items)

`batch.ts` already has JSDoc on `shouldContinue`, `handleOverflow`, and `runLoop`. This task covers the missing types.

**Files:**
- Modify: `src/core/batch.ts`

**Step 1: Add JSDoc to `LoopMode` and `OverflowDecision`**

Replace:
```typescript
export type LoopMode = 'plan' | 'build' | 'split';
```

With:
```typescript
/** The mode passed to `runLoop`. `'split'` is used internally after an overflow decision. */
export type LoopMode = 'plan' | 'build' | 'split';
```

Replace:
```typescript
export interface OverflowDecision {
  action: 'split' | 'escalate';
  nextModel: string;
}
```

With:
```typescript
/**
 * The decision taken by `handleOverflow` when Claude's context fills up.
 * - `split`: decompose the issue into sub-issues using `splitModel`
 * - `escalate`: retry with `extendedContextModel` (larger context window)
 */
export interface OverflowDecision {
  action: 'split' | 'escalate';
  nextModel: string;
}
```

**Step 2: Verify**

```bash
bun x tsc --noEmit
```

Expected: zero errors.

**Step 3: Run full test suite**

```bash
bun test
```

Expected: 64 pass, 0 fail.

**Step 4: Commit**

```bash
git add src/core/batch.ts
git commit -m "docs: JSDoc for LoopMode and OverflowDecision in batch.ts"
```

---

### Task 8: Final verification — TypeDoc generates clean output

**Step 1: Run TypeDoc**

```bash
bun run docs
```

Expected: Exits with code 0. The directory `docs/api/` is created containing `index.html`.

**Step 2: Check for TypeDoc validation errors**

TypeDoc may emit warnings about `invalidLink` references. Review output:
- Warnings about cross-package links are acceptable
- Hard errors (exit code != 0) must be fixed before committing

If there are `invalidLink` warnings from `@see` or `{@link}` tags, verify the referenced symbol names are correct. Common cause: linking to a name that isn't exported (e.g. `{@link parseBarfrc}` is exported, `{@link RawConfigSchema}` is not).

**Step 3: Spot-check the generated docs**

Open `docs/api/index.html` in a browser (or check the file exists):
```bash
ls docs/api/index.html
```

Confirm `docs/api/` was generated successfully.

**Step 4: Run full test suite one final time**

```bash
bun test
```

Expected: 64 pass, 0 fail.

**Step 5: Commit**

```bash
git add -f docs/api/ 2>/dev/null; git reset docs/api/ 2>/dev/null; true
git add typedoc.json package.json .gitignore
git commit -m "docs: verified typedoc generates clean output"
```

Note: do NOT commit `docs/api/` — it is git-ignored. This commit is only needed if `typedoc.json` or `package.json` weren't committed in Task 1.

---

## Summary

After all tasks:
- `bun run docs` generates `docs/api/` with HTML documentation
- All public types, classes, and functions have `/** */` JSDoc
- `bun test` still passes 64/64
- `bun x tsc --noEmit` still clean
- `docs/api/` is git-ignored (not committed)
