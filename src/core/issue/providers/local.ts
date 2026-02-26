import type { ResultAsync } from 'neverthrow'
import { IssueProvider } from '@/core/issue/base'
import {
  type LockInfo,
  LockInfoSchema,
  IssueStateSchema,
  type LockMode,
  type Issue,
  type IssueState,
} from '@/types'
import { parseIssue, serializeIssue } from '@/core/issue'
import { syncToResultAsync } from '@/utils/syncToResultAsync'
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
  mkdirSync,
  existsSync,
  rmSync,
  openSync,
  writeSync,
  closeSync,
  constants,
} from 'fs'
import { join } from 'path'

/**
 * File-system issue provider. Stores issues as frontmatter markdown files under `issuesDir`.
 *
 * **Locking:** Uses `O_CREAT | O_EXCL` atomicity — creates `.barf/<id>.lock` for exactly
 * one concurrent caller. The lock file carries PID, timestamp, state, and mode.
 * Stale locks (dead PID) are swept at construction and on every {@link isLocked} / {@link lockIssue} call.
 *
 * **Writes:** All writes are atomic — data is written to `<file>.tmp` then `rename`d to
 * the target, preventing partial reads.
 *
 * @category Issue Providers
 */
export class LocalIssueProvider extends IssueProvider {
  constructor(
    private issuesDir: string,
    private barfDir: string,
  ) {
    super()
    mkdirSync(barfDir, { recursive: true })
    this.sweepStaleLocks()
  }

  /**
   * Scans every `.lock` file in `barfDir` and removes those whose recorded PID is no
   * longer alive. Called once at construction so stale locks from previous crashes are
   * cleaned up regardless of which issue the next command targets.
   */
  private sweepStaleLocks(): void {
    let entries: string[]
    try {
      entries = readdirSync(this.barfDir)
    } catch {
      return // barfDir not readable yet — skip
    }
    for (const entry of entries) {
      if (!entry.endsWith('.lock')) {
        continue
      }
      this.readLockIfAlive(join(this.barfDir, entry))
    }
  }

  private issuePath(id: string): string {
    return join(this.issuesDir, `${id}.md`)
  }

  private lockPath(id: string): string {
    return join(this.barfDir, `${id}.lock`)
  }

  /**
   * Reads a lock file and returns its parsed contents if the recorded PID is still alive.
   * If the file is corrupt, unreadable, or its PID is dead, deletes the lock and returns `null`.
   */
  private readLockIfAlive(lockFile: string): LockInfo | null {
    let info: LockInfo
    try {
      info = LockInfoSchema.parse(JSON.parse(readFileSync(lockFile, 'utf8')))
    } catch {
      rmSync(lockFile, { force: true })
      return null
    }
    try {
      process.kill(info.pid, 0)
      return info
    } catch {
      rmSync(lockFile, { force: true })
      return null
    }
  }

  fetchIssue(id: string): ResultAsync<Issue, Error> {
    return syncToResultAsync(() => {
      const content = readFileSync(this.issuePath(id), 'utf8')
      return parseIssue(content).match(
        (issue) => issue,
        (e) => {
          throw e
        },
      )
    })
  }

  listIssues(filter?: { state?: IssueState }): ResultAsync<Issue[], Error> {
    return syncToResultAsync(() => {
      const entries = readdirSync(this.issuesDir)
      const issues: Issue[] = []
      for (const entry of entries) {
        if (entry.startsWith('.')) {
          continue
        }
        if (!entry.endsWith('.md')) {
          continue
        }
        const id = entry.replace(/\.md$/, '')
        try {
          const content = readFileSync(this.issuePath(id), 'utf8')
          const result = parseIssue(content)
          if (result.isOk()) {
            const issue = result.value
            if (!filter?.state || issue.state === filter.state) {
              issues.push(issue)
            }
          }
        } catch {
          /* skip unreadable files */
        }
      }
      return issues
    })
  }

  createIssue(input: {
    title: string
    body?: string
    parent?: string
  }): ResultAsync<Issue, Error> {
    return this.listIssues().andThen((existing) => {
      const maxId = existing
        .map((i) => {
          const num = parseInt(i.id.split('-')[0], 10)
          return Number.isFinite(num) ? num : 0
        })
        .reduce((a, b) => Math.max(a, b), 0)
      const id = String(maxId + 1).padStart(3, '0')
      const issue: Issue = {
        id,
        title: input.title,
        state: 'NEW',
        parent: input.parent ?? '',
        children: [],
        split_count: 0,
        force_split: false,
        verify_count: 0,
        body: input.body ?? '',
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_duration_seconds: 0,
        total_iterations: 0,
        run_count: 0,
      }
      return syncToResultAsync(() => {
        writeFileSync(join(this.issuesDir, `${id}.md`), serializeIssue(issue))
        return issue
      })
    })
  }

  writeIssue(
    id: string,
    fields: Partial<Omit<Issue, 'id'>>,
  ): ResultAsync<Issue, Error> {
    return this.fetchIssue(id).andThen((current) =>
      syncToResultAsync(() => {
        const updated = { ...current, ...fields }
        const target = this.issuePath(id)
        const tmp = `${target}.tmp`
        writeFileSync(tmp, serializeIssue(updated))
        renameSync(tmp, target)
        return updated
      }),
    )
  }

  deleteIssue(id: string): ResultAsync<void, Error> {
    return syncToResultAsync(() => {
      rmSync(this.issuePath(id), { force: true })
    })
  }

  lockIssue(id: string, meta?: { mode?: LockMode }): ResultAsync<void, Error> {
    return syncToResultAsync(() => {
      const content = readFileSync(this.issuePath(id), 'utf8')
      const stateMatch = content.match(/^state=(.+)$/m)
      const state = IssueStateSchema.catch('NEW').parse(stateMatch?.[1]?.trim())

      const lockData: LockInfo = {
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
        state,
        mode: meta?.mode ?? 'build',
      }

      const writelock = () => {
        // O_CREAT | O_EXCL: atomic, throws EEXIST if another process holds the lock
        const fd = openSync(
          this.lockPath(id),
          constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        )
        try {
          writeSync(fd, JSON.stringify(lockData))
        } finally {
          closeSync(fd)
        }
      }

      try {
        writelock()
      } catch (e) {
        // On EEXIST, check if the existing lock belongs to a dead process
        if (
          e instanceof Error &&
          (e as NodeJS.ErrnoException).code === 'EEXIST'
        ) {
          if (this.readLockIfAlive(this.lockPath(id)) === null) {
            writelock() // stale lock cleared — retry once
            return
          }
        }
        throw e
      }
    })
  }

  unlockIssue(id: string): ResultAsync<void, Error> {
    return syncToResultAsync(() => {
      rmSync(this.lockPath(id), { force: true })
    })
  }

  isLocked(id: string): ResultAsync<boolean, Error> {
    return syncToResultAsync(() => {
      const lockFile = this.lockPath(id)
      if (!existsSync(lockFile)) {
        return false
      }
      return this.readLockIfAlive(lockFile) !== null
    })
  }
}
