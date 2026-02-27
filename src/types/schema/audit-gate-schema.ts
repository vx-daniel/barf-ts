/**
 * Audit gate schemas — state machine for pausing builds and running code audits.
 *
 * The audit gate is persisted as `.barf/audit-gate.json` and read each iteration
 * of the auto loop. External triggers (dashboard, CLI) write to this file to
 * request an audit; the auto loop drives the state machine transitions.
 *
 * @module Configuration
 */
import { z } from 'zod'

/**
 * Valid states for the audit gate state machine.
 *
 * Transitions: `running → draining → auditing → fixing → running`
 * Any non-running state can be cancelled back to `running`.
 *
 * @category AuditGate
 */
export const AuditGateStateSchema = z.enum([
  'running',
  'draining',
  'auditing',
  'fixing',
])

/** A validated audit gate state. */
export type AuditGateState = z.infer<typeof AuditGateStateSchema>

/** Who triggered the audit gate. */
export const AuditGateTriggerSchema = z.enum(['dashboard', 'cli', 'auto'])

/** A validated audit gate trigger source. */
export type AuditGateTrigger = z.infer<typeof AuditGateTriggerSchema>

/**
 * Persisted audit gate state in `.barf/audit-gate.json`.
 *
 * Read by the auto loop each iteration to decide which phases to execute.
 * Written by the auto loop, dashboard, and CLI to drive transitions.
 *
 * @category AuditGate
 */
export const AuditGateSchema = z.object({
  /** Current state of the audit gate. */
  state: AuditGateStateSchema.default('running'),
  /** Who triggered the current audit gate activation. */
  triggeredBy: AuditGateTriggerSchema.optional(),
  /** ISO 8601 timestamp of when the gate was triggered. */
  triggeredAt: z.string().optional(),
  /** Number of issues completed since the last audit. Reset after each audit. */
  completedSinceLastAudit: z.number().int().nonnegative().default(0),
  /** Issue IDs created by the audit as fix issues. Cleared when gate returns to running. */
  auditFixIssueIds: z.array(z.string()).default([]),
})

/** A validated audit gate state object. */
export type AuditGate = z.infer<typeof AuditGateSchema>
