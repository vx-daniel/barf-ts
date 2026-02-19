import { ResultAsync, errAsync } from 'neverthrow'
import type { Issue, IssueState, LockMode } from '@/types'
import { validateTransition, parseAcceptanceCriteria } from '@/core/issue'

/**
 * Selects which priority queue to use when auto-picking an issue.
 *
 * @category Issue Providers
 */
export type AutoSelectMode = 'plan' | 'build'

const AUTO_SELECT_PRIORITY: Record<AutoSelectMode, IssueState[]> = {
  plan: ['NEW'],
  build: ['IN_PROGRESS', 'PLANNED', 'NEW']
}

/**
 * Abstract base for all barf issue storage backends.
 *
 * Concrete implementations: `LocalIssueProvider`, `GitHubIssueProvider`.
 *
 * To add a custom backend: extend this class and implement the eight abstract methods.
 * The `transition`, `autoSelect`, and `checkAcceptanceCriteria` methods are
 * provided and shared by all providers.
 *
 * @category Issue Providers
 */
export abstract class IssueProvider {
  // ── Abstract I/O — implemented per provider ───────────────────────────────

  /**
   * Retrieves a single issue by ID.
   *
   * @param id - Issue identifier (e.g. `'001'` for local, GitHub issue number for github).
   * @returns `ok(Issue)` on success, `err(Error)` if the issue does not exist or cannot be read.
   * @example
   * const result = await provider.fetchIssue('001');
   * if (result.isErr()) logger.error({ err: result.error }, 'fetch failed');
   * @group I/O — Override in Provider
   */
  abstract fetchIssue(id: string): ResultAsync<Issue, Error>

  /**
   * Lists all issues, optionally filtered by state.
   *
   * @param filter - If `filter.state` is set, only issues in that state are returned.
   * @returns `ok(Issue[])` on success, `err(Error)` on I/O or API failure.
   * @example
   * const result = await provider.listIssues({ state: 'NEW' });
   * if (result.isOk()) result.value.forEach(i => logger.info({ id: i.id }, 'found'));
   * @group I/O — Override in Provider
   */
  abstract listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error>

  /**
   * Creates a new issue with state `NEW`.
   *
   * @param input - `title` is required; `body` and `parent` are optional.
   * @returns `ok(Issue)` with the persisted issue (including assigned id), `err(Error)` on I/O or API failure.
   * @example
   * const result = await provider.createIssue({ title: 'Fix login bug', body: '...' });
   * if (result.isErr()) logger.error({ err: result.error }, 'create failed');
   * @group I/O — Override in Provider
   */
  abstract createIssue(input: {
    title: string
    body?: string
    parent?: string
  }): ResultAsync<Issue, Error>

  /**
   * Patches an issue's fields. Implementations must write atomically.
   * The `id` field cannot be patched — it is excluded from `fields`.
   *
   * @param id - Issue to update.
   * @param fields - Subset of {@link Issue} fields to overwrite; `id` is excluded.
   * @returns `ok(Issue)` with the full updated issue, `err(Error)` on I/O or API failure.
   * @example
   * const result = await provider.writeIssue('001', { title: 'Updated title' });
   * if (result.isErr()) logger.error({ err: result.error }, 'write failed');
   * @group I/O — Override in Provider
   */
  abstract writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): ResultAsync<Issue, Error>

  /**
   * Permanently deletes an issue.
   * GitHub provider always returns `err` — use `transition(id, 'COMPLETED')` there.
   *
   * @param id - Issue to delete.
   * @returns `ok(void)` on success, `err(Error)` on I/O failure or if deletion is unsupported.
   * @example
   * const result = await provider.deleteIssue('001');
   * if (result.isErr()) logger.warn({ err: result.error }, 'delete unsupported, transition instead');
   * @group I/O — Override in Provider
   */
  abstract deleteIssue(id: string): ResultAsync<void, Error>

  /**
   * Acquires an exclusive lock on the issue.
   *
   * - `LocalIssueProvider`: `O_CREAT | O_EXCL` atomic file creation in `.barf/<id>.lock`
   * - `GitHubIssueProvider`: adds the `barf:locked` label (meta ignored)
   *
   * @param id - Issue to lock.
   * @param meta - Optional metadata written into the lock record.
   * @returns `ok(void)` on success, `err(Error)` if the issue is already locked.
   * @example
   * const result = await provider.lockIssue('001', { mode: 'build' });
   * if (result.isErr()) throw new Error('Already locked by another process');
   * @group I/O — Override in Provider
   */
  abstract lockIssue(id: string, meta?: { mode?: LockMode }): ResultAsync<void, Error>

  /**
   * Releases the lock acquired by {@link lockIssue}. Safe to call if not locked.
   *
   * @param id - Issue to unlock.
   * @returns `ok(void)` always — implementations must not return `err` for a no-op unlock.
   * @example
   * await provider.unlockIssue('001'); // safe even if not currently locked
   * @group I/O — Override in Provider
   */
  abstract unlockIssue(id: string): ResultAsync<void, Error>

  /**
   * Checks whether the issue is currently locked by any process.
   *
   * @param id - Issue to check.
   * @returns `ok(true)` if locked, `ok(false)` if not, `err(Error)` on I/O or API failure.
   * @example
   * const result = await provider.isLocked('001');
   * if (result.isOk() && result.value) logger.warn({ id: '001' }, 'issue is locked, skipping');
   * @group I/O — Override in Provider
   */
  abstract isLocked(id: string): ResultAsync<boolean, Error>

  // ── Shared logic — one implementation for all providers ───────────────────

  /**
   * Validates and applies a state transition.
   *
   * Delegates validation to {@link validateTransition}; writes the new state via
   * {@link writeIssue}. Call this instead of patching `state` directly to preserve invariants.
   *
   * @param id - Issue whose state will change.
   * @param to - Target state; must be reachable from the current state per `VALID_TRANSITIONS`.
   * @returns `ok(Issue)` with the updated issue, `err(InvalidTransitionError)` if the move is illegal,
   *   or `err(Error)` on I/O failure.
   * @group Derived
   */
  transition(id: string, to: IssueState): ResultAsync<Issue, Error> {
    return this.fetchIssue(id).andThen(issue => {
      const validation = validateTransition(issue.state, to)
      if (validation.isErr()) {
        return errAsync(validation.error)
      }
      return this.writeIssue(id, { state: to })
    })
  }

  /**
   * Selects the highest-priority available (unlocked) issue for the given mode.
   *
   * Priority order per {@link AutoSelectMode}:
   * - `plan`: NEW
   * - `build`: IN_PROGRESS → PLANNED → NEW
   *
   * @param mode - Determines which states are considered and their priority order.
   * @returns `ok(Issue)` for the best candidate, `ok(null)` if no eligible unlocked issue exists,
   *   or `err(Error)` on I/O failure.
   * @group Derived
   */
  autoSelect(mode: AutoSelectMode): ResultAsync<Issue | null, Error> {
    return this.listIssues().andThen(issues => {
      const lockChecks = issues.map(issue =>
        this.isLocked(issue.id).map(locked => ({ issue, locked }))
      )
      return ResultAsync.combine(lockChecks).map(entries => {
        const available = entries.filter(({ locked }) => !locked).map(({ issue }) => issue)
        for (const priority of AUTO_SELECT_PRIORITY[mode]) {
          const match = available.find(i => i.state === priority)
          if (match) {
            return match
          }
        }
        return null
      })
    })
  }

  /**
   * Checks whether all acceptance criteria checkboxes in the issue body are ticked.
   * Delegates parsing to {@link parseAcceptanceCriteria}.
   *
   * @param id - Issue to inspect.
   * @returns `ok(true)` if all criteria are checked (or the section is absent),
   *   `ok(false)` if any `- [ ]` item remains, or `err(Error)` if the issue cannot be fetched.
   * @group Derived
   */
  checkAcceptanceCriteria(id: string): ResultAsync<boolean, Error> {
    return this.fetchIssue(id).map(issue => parseAcceptanceCriteria(issue.body))
  }
}
