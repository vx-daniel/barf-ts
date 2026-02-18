import { ResultAsync, errAsync } from 'neverthrow'
import type { Issue, IssueState } from '@/types/index'
import { validateTransition, parseAcceptanceCriteria } from '@/core/issue'

/** Selects which priority queue to use when auto-picking an issue. */
export type AutoSelectMode = 'plan' | 'build'

const AUTO_SELECT_PRIORITY: Record<AutoSelectMode, IssueState[]> = {
  plan: ['NEW'],
  build: ['IN_PROGRESS', 'PLANNED', 'NEW']
}

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

  /** Retrieves a single issue by ID. Returns `err` if the issue does not exist. */
  abstract fetchIssue(id: string): ResultAsync<Issue, Error>

  /**
   * Lists all issues, optionally filtered by state.
   * @param filter - Optional filter; if `state` is set, only matching issues are returned.
   */
  abstract listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error>

  /**
   * Creates a new issue with state `NEW`.
   * @param input - Title is required; body and parent are optional.
   */
  abstract createIssue(input: {
    title: string
    body?: string
    parent?: string
  }): ResultAsync<Issue, Error>

  /**
   * Patches an issue's fields. Implementations should write atomically.
   * The `id` field cannot be patched — it is excluded from `fields`.
   */
  abstract writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): ResultAsync<Issue, Error>

  /**
   * Permanently deletes an issue.
   * GitHub provider returns `err` instead — use `transition(id, 'COMPLETED')` there.
   */
  abstract deleteIssue(id: string): ResultAsync<void, Error>

  /**
   * Acquires an exclusive lock on the issue.
   *
   * - LocalIssueProvider: uses `mkdir` atomicity + renames `.md` → `.md.working`
   * - GitHubIssueProvider: adds the `barf:locked` label
   *
   * Returns `err` if the issue is already locked.
   */
  abstract lockIssue(id: string): ResultAsync<void, Error>

  /** Releases the lock acquired by {@link lockIssue}. Safe to call if not locked. */
  abstract unlockIssue(id: string): ResultAsync<void, Error>

  /** Returns `true` if the issue is currently locked by any process. */
  abstract isLocked(id: string): ResultAsync<boolean, Error>

  // ── Shared logic — one implementation for all providers ───────────────────

  /**
   * Validates and applies a state transition.
   *
   * Delegates validation to {@link validateTransition}; writes the new state via
   * {@link writeIssue}. Returns `err(InvalidTransitionError)` for illegal moves.
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
   * Priority order:
   * - `plan`: NEW
   * - `build`: IN_PROGRESS → PLANNED → NEW
   *
   * Returns `null` if no eligible (matching state + unlocked) issue exists.
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
   * Returns `true` if all acceptance criteria checkboxes in the issue body are ticked.
   * Delegates to {@link parseAcceptanceCriteria}.
   */
  checkAcceptanceCriteria(id: string): ResultAsync<boolean, Error> {
    return this.fetchIssue(id).map(issue => parseAcceptanceCriteria(issue.body))
  }
}
