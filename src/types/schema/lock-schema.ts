/**
 * Lock model schemas — POSIX file locking for concurrent issue access.
 *
 * Barf uses lock files under `.barf/<id>.lock` to prevent multiple processes
 * from working on the same issue simultaneously. The lock file contains JSON
 * matching {@link LockInfoSchema}, which enables stale-lock detection (by
 * checking if the PID is still alive) and status display.
 *
 * @module Configuration
 */
import { z } from 'zod'
import { IssueStateSchema } from './issue-schema'
import { LoopModeSchema } from './mode-schema'

/**
 * Runtime mode that acquired the lock.
 *
 * Alias for {@link LoopModeSchema} — locks are only acquired during
 * orchestration loop execution (plan, build, or split modes).
 *
 * @category Locking
 * @group Locking
 */
export const LockModeSchema = LoopModeSchema

/**
 * A barf lock mode. Derived from {@link LockModeSchema}.
 *
 * @category Locking
 * @group Locking
 */
export type LockMode = z.infer<typeof LockModeSchema>

/**
 * Contents of a `.barf/<id>.lock` file.
 *
 * Written atomically at lock acquisition using `O_CREAT | O_EXCL` for POSIX
 * safety. The `pid` field enables stale-lock detection: if the process that
 * created the lock is no longer alive, the lock is considered stale and
 * can be cleaned up automatically.
 *
 * @category Locking
 * @group Locking
 */
export const LockInfoSchema = z.object({
  /** PID of the process that acquired this lock. Used for stale-lock detection. */
  pid: z.number().int().positive(),
  /** ISO 8601 timestamp of when the lock was acquired. */
  acquiredAt: z.string().datetime(),
  /** Issue state at the time the lock was acquired. */
  state: IssueStateSchema,
  /** Orchestration mode that acquired the lock (plan, build, or split). */
  mode: LockModeSchema,
})

/**
 * Parsed lock file contents. Derived from {@link LockInfoSchema}.
 *
 * @category Locking
 * @group Locking
 */
export type LockInfo = z.infer<typeof LockInfoSchema>
