/**
 * Session index schemas — tracks session lifecycle in `.barf/sessions.jsonl`.
 *
 * Each barf orchestration run (plan, build, split) writes a `start` event at
 * lock acquisition and an `end` event in the `finally` block. Auto runs write
 * `auto_start`/`auto_end` wrapper events. The dashboard reads this index to
 * populate the session browser panel.
 *
 * @module Configuration
 */
import { z } from 'zod'
import { LoopModeSchema } from './mode-schema'

/**
 * Written by {@link runLoop} immediately after acquiring the issue lock.
 *
 * @category Sessions
 */
export const SessionStartEventSchema = z.object({
  /** Discriminator for event type. */
  event: z.literal('start'),
  /** Unique session identifier: `${issueId}-${timestamp}`. */
  sessionId: z.string(),
  /** PID of the process running this session. Used for liveness checks and stop. */
  pid: z.number().int().positive(),
  /** Issue being processed. */
  issueId: z.string(),
  /** Orchestration mode (plan, build, split). */
  mode: LoopModeSchema,
  /** Model used for this session. */
  model: z.string(),
  /** ISO 8601 timestamp of session start. */
  timestamp: z.string().datetime(),
  /** Byte offset into the issue's stream JSONL file at session start. */
  streamOffset: z.number().int().nonnegative(),
  /** Parent session ID for auto-spawned child sessions. */
  parentSessionId: z.string().optional(),
})

/** A validated session start event. */
export type SessionStartEvent = z.infer<typeof SessionStartEventSchema>

/**
 * Written by {@link runLoop} in the `finally` block before releasing the lock.
 *
 * @category Sessions
 */
export const SessionEndEventSchema = z.object({
  /** Discriminator for event type. */
  event: z.literal('end'),
  /** Session identifier matching the corresponding start event. */
  sessionId: z.string(),
  /** PID of the process (for correlation). */
  pid: z.number().int().positive(),
  /** ISO 8601 timestamp of session end. */
  timestamp: z.string().datetime(),
  /** Byte offset into the issue's stream JSONL file at session end. */
  streamEndOffset: z.number().int().nonnegative(),
  /** Input tokens consumed during this session. */
  inputTokens: z.number().nonnegative(),
  /** Output tokens consumed during this session. */
  outputTokens: z.number().nonnegative(),
  /** Number of iterations executed. */
  iterations: z.number().int().nonnegative(),
  /** Wall-clock duration in seconds. */
  durationSeconds: z.number().nonnegative(),
})

/** A validated session end event. */
export type SessionEndEvent = z.infer<typeof SessionEndEventSchema>

/**
 * Written by the auto command before processing issues.
 *
 * @category Sessions
 */
export const AutoStartEventSchema = z.object({
  /** Discriminator for event type. */
  event: z.literal('auto_start'),
  /** Unique auto session identifier: `auto-${timestamp}`. */
  sessionId: z.string(),
  /** PID of the auto command process. */
  pid: z.number().int().positive(),
  /** ISO 8601 timestamp. */
  timestamp: z.string().datetime(),
})

/** A validated auto start event. */
export type AutoStartEvent = z.infer<typeof AutoStartEventSchema>

/**
 * Written by the auto command after all phases complete.
 *
 * @category Sessions
 */
export const AutoEndEventSchema = z.object({
  /** Discriminator for event type. */
  event: z.literal('auto_end'),
  /** Auto session identifier matching the corresponding auto_start. */
  sessionId: z.string(),
  /** PID of the auto command process. */
  pid: z.number().int().positive(),
  /** ISO 8601 timestamp. */
  timestamp: z.string().datetime(),
  /** Number of issues processed in this auto run. */
  issueCount: z.number().int().nonnegative(),
})

/** A validated auto end event. */
export type AutoEndEvent = z.infer<typeof AutoEndEventSchema>

/**
 * Written by the dashboard when a user deletes a session from the browser.
 * The session is filtered out of {@link listSessions} results but the original
 * start/end events remain in the JSONL file (append-only).
 *
 * @category Sessions
 */
export const SessionDeleteEventSchema = z.object({
  /** Discriminator for event type. */
  event: z.literal('delete'),
  /** Session identifier to mark as deleted. */
  sessionId: z.string(),
  /** ISO 8601 timestamp of deletion. */
  timestamp: z.string().datetime(),
})

/** A validated session delete event. */
export type SessionDeleteEvent = z.infer<typeof SessionDeleteEventSchema>

/**
 * Written by the dashboard when a user archives a session. Archived sessions
 * are hidden by default but can be shown via a UI toggle. Like delete, the
 * original events remain in the JSONL file.
 *
 * @category Sessions
 */
export const SessionArchiveEventSchema = z.object({
  /** Discriminator for event type. */
  event: z.literal('archive'),
  /** Session identifier to mark as archived. */
  sessionId: z.string(),
  /** ISO 8601 timestamp of archival. */
  timestamp: z.string().datetime(),
})

/** A validated session archive event. */
export type SessionArchiveEvent = z.infer<typeof SessionArchiveEventSchema>

/**
 * Written when the audit gate transitions between states.
 * Tracked in the session index for dashboard visibility.
 *
 * @category Sessions
 */
export const AuditGateEventSchema = z.object({
  /** Discriminator for event type. */
  event: z.literal('audit_gate'),
  /** The gate state being entered. */
  gateState: z.enum([
    'draining',
    'auditing',
    'fixing',
    'completed',
    'cancelled',
  ]),
  /** ISO 8601 timestamp of the transition. */
  timestamp: z.string().datetime(),
  /** Who triggered the audit gate (present on initial trigger). */
  triggeredBy: z.enum(['dashboard', 'cli', 'auto']).optional(),
  /** Number of fix issues created (present on fixing transition). */
  fixIssueCount: z.number().int().nonnegative().optional(),
})

/** A validated audit gate event. */
export type AuditGateEvent = z.infer<typeof AuditGateEventSchema>

/**
 * Union of all session index event types.
 *
 * @category Sessions
 */
export const SessionIndexEventSchema = z.discriminatedUnion('event', [
  SessionStartEventSchema,
  SessionEndEventSchema,
  AutoStartEventSchema,
  AutoEndEventSchema,
  SessionDeleteEventSchema,
  SessionArchiveEventSchema,
  AuditGateEventSchema,
])

/** Any session index event. */
export type SessionIndexEvent = z.infer<typeof SessionIndexEventSchema>

/** Session status derived from index events + PID liveness. */
export type SessionStatus = 'running' | 'completed' | 'crashed'

/**
 * A merged session view combining start + end events for the dashboard.
 *
 * @category Sessions
 */
export interface Session {
  sessionId: string
  pid: number
  issueId?: string
  mode?: string
  model?: string
  startedAt: string
  endedAt?: string
  status: SessionStatus
  streamOffset?: number
  streamEndOffset?: number
  inputTokens?: number
  outputTokens?: number
  iterations?: number
  durationSeconds?: number
  parentSessionId?: string
  /** Whether this session has been archived. */
  archived?: boolean
  /** For auto sessions: child session IDs. */
  children?: string[]
}
