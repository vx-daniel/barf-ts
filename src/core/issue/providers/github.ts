import { errAsync, ResultAsync } from 'neverthrow'
import { z } from 'zod'
import { IssueProvider } from '@/core/issue/base'
import type { Issue, IssueState, LockMode } from '@/types'
import { type ExecResult, execFileNoThrow } from '@/utils/execFileNoThrow'
import { toError } from '@/utils/toError'
import {
  STATE_TO_LABEL,
  GHIssueSchema,
  ghToIssue,
} from './github-labels'

/**
 * Injectable subprocess function matching the {@link execFileNoThrow} signature.
 * Pass a mock in tests to avoid real `gh` CLI network calls without process-global patching.
 *
 * @category Issue Providers
 */
export type SpawnFn = (file: string, args?: string[]) => Promise<ExecResult>

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
 *
 * @category Issue Providers
 */
export class GitHubIssueProvider extends IssueProvider {
  private token: string = ''
  private spawnFile: SpawnFn

  constructor(
    private repo: string,
    spawnFn?: SpawnFn,
  ) {
    super()
    this.spawnFile = spawnFn ?? execFileNoThrow
  }

  private ensureAuth(): ResultAsync<string, Error> {
    if (this.token) {
      return ResultAsync.fromSafePromise(Promise.resolve(this.token))
    }
    return ResultAsync.fromPromise(
      this.spawnFile('gh', ['auth', 'token']),
      toError,
    ).andThen((result) => {
      if (result.status !== 0) {
        return errAsync(
          new Error(`gh auth failed — run: gh auth login\n${result.stderr}`),
        )
      }
      this.token = result.stdout.trim()
      return ResultAsync.fromSafePromise(Promise.resolve(this.token))
    })
  }

  private ghApi<T>(
    schema: z.ZodType<T>,
    args: string[],
  ): ResultAsync<T, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        this.spawnFile('gh', ['api', ...args]),
        toError,
      ).andThen((result) => {
        if (result.status !== 0) {
          return errAsync(new Error(`gh api error: ${result.stderr}`))
        }
        const parsed = schema.safeParse(JSON.parse(result.stdout))
        return parsed.success
          ? ResultAsync.fromSafePromise(Promise.resolve(parsed.data))
          : errAsync(parsed.error as Error)
      }),
    )
  }

  fetchIssue(id: string): ResultAsync<Issue, Error> {
    return this.ghApi(GHIssueSchema, [`/repos/${this.repo}/issues/${id}`]).map(
      ghToIssue,
    )
  }

  listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error> {
    const labelParam = filter?.state
      ? `&labels=${encodeURIComponent(STATE_TO_LABEL[filter.state])}`
      : ''
    return this.ghApi(z.array(GHIssueSchema), [
      `/repos/${this.repo}/issues?state=open&per_page=100${labelParam}`,
    ]).map((ghs) => ghs.map(ghToIssue))
  }

  createIssue(input: {
    title: string
    body?: string
    parent?: string
  }): ResultAsync<Issue, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        this.spawnFile('gh', [
          'api',
          '--method',
          'POST',
          `/repos/${this.repo}/issues`,
          '-f',
          `title=${input.title}`,
          '-f',
          `body=${input.body ?? ''}`,
          '-f',
          'labels[]=barf:new',
        ]),
        toError,
      ).andThen((result) => {
        if (result.status !== 0) {
          return errAsync(new Error(`Failed to create issue: ${result.stderr}`))
        }
        const parsed = GHIssueSchema.safeParse(JSON.parse(result.stdout))
        return parsed.success
          ? ResultAsync.fromSafePromise(Promise.resolve(ghToIssue(parsed.data)))
          : errAsync(parsed.error as Error)
      }),
    )
  }

  writeIssue(
    id: string,
    fields: Partial<Omit<Issue, 'id'>>,
  ): ResultAsync<Issue, Error> {
    return this.fetchIssue(id).andThen((current) => {
      const steps: ResultAsync<unknown, Error>[] = []
      if (fields.state && fields.state !== current.state) {
        const oldLabel = STATE_TO_LABEL[current.state]
        const newLabel = STATE_TO_LABEL[fields.state]
        steps.push(
          ResultAsync.fromPromise(
            this.spawnFile('gh', [
              'api',
              '--method',
              'DELETE',
              `/repos/${this.repo}/issues/${id}/labels/${encodeURIComponent(oldLabel)}`,
            ]),
            toError,
          ).andThen(() =>
            ResultAsync.fromPromise(
              this.spawnFile('gh', [
                'api',
                '--method',
                'POST',
                `/repos/${this.repo}/issues/${id}/labels`,
                '-f',
                `labels[]=${newLabel}`,
              ]),
              toError,
            ),
          ),
        )
      }
      const patchArgs = [
        '--method',
        'PATCH',
        `/repos/${this.repo}/issues/${id}`,
      ]
      if (fields.title) {
        patchArgs.push('-f', `title=${fields.title}`)
      }
      if (fields.body !== undefined) {
        patchArgs.push('-f', `body=${fields.body}`)
      }
      if (fields.state === 'COMPLETED') {
        patchArgs.push('-f', 'state=closed')
      }
      return ResultAsync.combine(steps).andThen(() =>
        this.ghApi(GHIssueSchema, patchArgs).map(ghToIssue),
      )
    })
  }

  deleteIssue(_id: string): ResultAsync<void, Error> {
    return errAsync(
      new Error(
        'GitHub Issues cannot be deleted via API. Transition to COMPLETED instead.',
      ),
    )
  }

  lockIssue(id: string, _meta?: { mode?: LockMode }): ResultAsync<void, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        this.spawnFile('gh', [
          'api',
          '--method',
          'POST',
          `/repos/${this.repo}/issues/${id}/labels`,
          '-f',
          'labels[]=barf:locked',
        ]),
        toError,
      ).map(() => undefined),
    )
  }

  unlockIssue(id: string): ResultAsync<void, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        this.spawnFile('gh', [
          'api',
          '--method',
          'DELETE',
          `/repos/${this.repo}/issues/${id}/labels/${encodeURIComponent('barf:locked')}`,
        ]),
        toError,
      ).map(() => undefined),
    )
  }

  isLocked(id: string): ResultAsync<boolean, Error> {
    return this.ghApi(GHIssueSchema, [`/repos/${this.repo}/issues/${id}`]).map(
      (gh) => gh.labels.some((l) => l.name === 'barf:locked'),
    )
  }
}
