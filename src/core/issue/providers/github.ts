import { z } from 'zod'
import { ResultAsync, errAsync } from 'neverthrow'
import { IssueProvider } from '@/core/issue/base'
import type { Issue, IssueState, LockMode } from '@/types'
import { execFileNoThrow, type ExecResult } from '@/utils/execFileNoThrow'

/**
 * Injectable subprocess function matching the {@link execFileNoThrow} signature.
 * Pass a mock in tests to avoid real `gh` CLI network calls without process-global patching.
 *
 * @category Issue Providers
 */
export type SpawnFn = (file: string, args?: string[]) => Promise<ExecResult>

const STATE_TO_LABEL: Record<IssueState, string> = {
  NEW: 'barf:new',
  INTERVIEWING: 'barf:interviewing',
  PLANNED: 'barf:planned',
  IN_PROGRESS: 'barf:in-progress',
  STUCK: 'barf:stuck',
  SPLIT: 'barf:split',
  COMPLETED: 'barf:completed'
}
const LABEL_TO_STATE: Record<string, IssueState> = Object.fromEntries(
  (Object.entries(STATE_TO_LABEL) as [IssueState, string][]).map(([s, l]) => [l, s])
)

const GHIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z
    .string()
    .nullable()
    .transform(v => v ?? ''),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.object({ name: z.string() })),
  milestone: z.object({ number: z.number(), title: z.string() }).nullable()
})
type GHIssue = z.infer<typeof GHIssueSchema>

function ghToIssue(gh: GHIssue): Issue {
  const stateLabel = gh.labels.find(l => LABEL_TO_STATE[l.name])
  const state: IssueState =
    gh.state === 'closed' ? 'COMPLETED' : stateLabel ? LABEL_TO_STATE[stateLabel.name] : 'NEW'
  return {
    id: String(gh.number),
    title: gh.title,
    state,
    parent: '',
    children: [],
    split_count: 0,
    force_split: false,
    body: gh.body
  }
}

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
    spawnFn?: SpawnFn
  ) {
    super()
    this.spawnFile = spawnFn ?? execFileNoThrow
  }

  private ensureAuth(): ResultAsync<string, Error> {
    if (this.token) {
      return ResultAsync.fromSafePromise(Promise.resolve(this.token))
    }
    return ResultAsync.fromPromise(this.spawnFile('gh', ['auth', 'token']), e =>
      e instanceof Error ? e : new Error(String(e))
    ).andThen(result => {
      if (result.status !== 0) {
        return errAsync(new Error(`gh auth failed — run: gh auth login\n${result.stderr}`))
      }
      this.token = result.stdout.trim()
      return ResultAsync.fromSafePromise(Promise.resolve(this.token))
    })
  }

  private ghApi<T>(schema: z.ZodType<T>, args: string[]): ResultAsync<T, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(this.spawnFile('gh', ['api', ...args]), e =>
        e instanceof Error ? e : new Error(String(e))
      ).andThen(result => {
        if (result.status !== 0) {
          return errAsync(new Error(`gh api error: ${result.stderr}`))
        }
        const parsed = schema.safeParse(JSON.parse(result.stdout))
        return parsed.success
          ? ResultAsync.fromSafePromise(Promise.resolve(parsed.data))
          : errAsync(parsed.error as Error)
      })
    )
  }

  fetchIssue(id: string): ResultAsync<Issue, Error> {
    return this.ghApi(GHIssueSchema, [`/repos/${this.repo}/issues/${id}`]).map(ghToIssue)
  }

  listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error> {
    const labelParam = filter?.state
      ? `&labels=${encodeURIComponent(STATE_TO_LABEL[filter.state])}`
      : ''
    return this.ghApi(z.array(GHIssueSchema), [
      `/repos/${this.repo}/issues?state=open&per_page=100${labelParam}`
    ]).map(ghs => ghs.map(ghToIssue))
  }

  createIssue(input: { title: string; body?: string; parent?: string }): ResultAsync<Issue, Error> {
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
          'labels[]=barf:new'
        ]),
        e => (e instanceof Error ? e : new Error(String(e)))
      ).andThen(result => {
        if (result.status !== 0) {
          return errAsync(new Error(`Failed to create issue: ${result.stderr}`))
        }
        const parsed = GHIssueSchema.safeParse(JSON.parse(result.stdout))
        return parsed.success
          ? ResultAsync.fromSafePromise(Promise.resolve(ghToIssue(parsed.data)))
          : errAsync(parsed.error as Error)
      })
    )
  }

  writeIssue(id: string, fields: Partial<Omit<Issue, 'id'>>): ResultAsync<Issue, Error> {
    return this.fetchIssue(id).andThen(current => {
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
              `/repos/${this.repo}/issues/${id}/labels/${encodeURIComponent(oldLabel)}`
            ]),
            e => (e instanceof Error ? e : new Error(String(e)))
          ).andThen(() =>
            ResultAsync.fromPromise(
              this.spawnFile('gh', [
                'api',
                '--method',
                'POST',
                `/repos/${this.repo}/issues/${id}/labels`,
                '-f',
                `labels[]=${newLabel}`
              ]),
              e => (e instanceof Error ? e : new Error(String(e)))
            )
          )
        )
      }
      const patchArgs = ['--method', 'PATCH', `/repos/${this.repo}/issues/${id}`]
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
        this.ghApi(GHIssueSchema, patchArgs).map(ghToIssue)
      )
    })
  }

  deleteIssue(_id: string): ResultAsync<void, Error> {
    return errAsync(
      new Error('GitHub Issues cannot be deleted via API. Transition to COMPLETED instead.')
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
          'labels[]=barf:locked'
        ]),
        e => (e instanceof Error ? e : new Error(String(e)))
      ).map(() => undefined)
    )
  }

  unlockIssue(id: string): ResultAsync<void, Error> {
    return this.ensureAuth().andThen(() =>
      ResultAsync.fromPromise(
        this.spawnFile('gh', [
          'api',
          '--method',
          'DELETE',
          `/repos/${this.repo}/issues/${id}/labels/${encodeURIComponent('barf:locked')}`
        ]),
        e => (e instanceof Error ? e : new Error(String(e)))
      ).map(() => undefined)
    )
  }

  isLocked(id: string): ResultAsync<boolean, Error> {
    return this.ghApi(GHIssueSchema, [`/repos/${this.repo}/issues/${id}`]).map(gh =>
      gh.labels.some(l => l.name === 'barf:locked')
    )
  }
}
