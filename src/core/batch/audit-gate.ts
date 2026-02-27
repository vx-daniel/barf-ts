/**
 * Audit gate I/O — reads and writes the `.barf/audit-gate.json` state file.
 *
 * The audit gate is a state machine that pauses the auto loop's build pipeline,
 * runs an external code audit, and blocks non-fix builds until audit findings
 * are resolved. This module provides pure functions for state transitions and
 * file I/O for persistence.
 *
 * @module Orchestration
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AuditGate, AuditGateTrigger, Config } from '@/types'
import { AuditGateSchema } from '@/types/schema/audit-gate-schema'
import { createLogger } from '@/utils/logger'

const logger = createLogger('audit-gate')

const GATE_FILE = 'audit-gate.json'

/**
 * Reads the current audit gate state from `.barf/audit-gate.json`.
 * Returns a default `{ state: 'running' }` gate if the file does not exist or is invalid.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @returns The current audit gate state, validated and defaulted.
 */
export function readAuditGate(barfDir: string): AuditGate {
  const filePath = join(barfDir, GATE_FILE)
  try {
    if (!existsSync(filePath)) {
      return AuditGateSchema.parse({})
    }
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
    return AuditGateSchema.parse(raw)
  } catch (e) {
    logger.warn(
      { err: e instanceof Error ? e.message : String(e) },
      'failed to read audit gate — defaulting to running',
    )
    return AuditGateSchema.parse({})
  }
}

/**
 * Writes the audit gate state to `.barf/audit-gate.json`.
 * Creates the `.barf` directory if it does not exist.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param gate - The audit gate state to persist.
 */
export function writeAuditGate(barfDir: string, gate: AuditGate): void {
  mkdirSync(barfDir, { recursive: true })
  const filePath = join(barfDir, GATE_FILE)
  writeFileSync(filePath, `${JSON.stringify(gate, null, 2)}\n`)
}

/**
 * Triggers the audit gate by transitioning to `draining` state.
 * No-op if the gate is already in a non-running state.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param triggeredBy - Who triggered the audit gate.
 * @returns `true` if the gate was triggered, `false` if it was already active.
 */
export function triggerAuditGate(
  barfDir: string,
  triggeredBy: AuditGateTrigger,
): boolean {
  const gate = readAuditGate(barfDir)
  if (gate.state !== 'running') {
    logger.info(
      { currentState: gate.state },
      'audit gate already active — ignoring trigger',
    )
    return false
  }
  writeAuditGate(barfDir, {
    ...gate,
    state: 'draining',
    triggeredBy,
    triggeredAt: new Date().toISOString(),
  })
  logger.info({ triggeredBy }, 'audit gate triggered — entering draining state')
  return true
}

/**
 * Cancels the audit gate by resetting to `running` state.
 * Clears all gate metadata (fix issue IDs, trigger info) but preserves the completed counter.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @returns `true` if the gate was cancelled, `false` if it was already running.
 */
export function cancelAuditGate(barfDir: string): boolean {
  const gate = readAuditGate(barfDir)
  if (gate.state === 'running') {
    return false
  }
  writeAuditGate(barfDir, {
    state: 'running',
    completedSinceLastAudit: gate.completedSinceLastAudit,
    auditFixIssueIds: [],
  })
  logger.info({ previousState: gate.state }, 'audit gate cancelled')
  return true
}

/**
 * Increments the completed-since-last-audit counter.
 * Called after each successful build completion in the auto loop.
 *
 * @param barfDir - Path to the `.barf` directory.
 */
export function incrementCompleted(barfDir: string): void {
  const gate = readAuditGate(barfDir)
  writeAuditGate(barfDir, {
    ...gate,
    completedSinceLastAudit: gate.completedSinceLastAudit + 1,
  })
}

/**
 * Pure function: checks whether the auto-trigger threshold has been reached.
 *
 * @param gate - Current audit gate state.
 * @param config - Loaded barf configuration (uses `auditAfterNCompleted`).
 * @returns `true` if the gate should auto-trigger.
 */
export function checkAutoTrigger(gate: AuditGate, config: Config): boolean {
  if (config.auditAfterNCompleted <= 0) return false
  if (gate.state !== 'running') return false
  return gate.completedSinceLastAudit >= config.auditAfterNCompleted
}

/**
 * Resets the audit gate to running state with a zeroed counter.
 * Called when the audit cycle completes (all fix issues resolved or no findings).
 *
 * @param barfDir - Path to the `.barf` directory.
 */
export function resetAuditGate(barfDir: string): void {
  writeAuditGate(barfDir, AuditGateSchema.parse({}))
  logger.info('audit gate reset to running')
}

/**
 * Transitions the audit gate to the `auditing` state.
 * Called when all active sessions have drained.
 *
 * @param barfDir - Path to the `.barf` directory.
 */
export function transitionToAuditing(barfDir: string): void {
  const gate = readAuditGate(barfDir)
  writeAuditGate(barfDir, { ...gate, state: 'auditing' })
  logger.info('audit gate transitioned to auditing')
}

/**
 * Transitions the audit gate to the `fixing` state with the given fix issue IDs.
 * Called after the audit creates fix issues.
 *
 * @param barfDir - Path to the `.barf` directory.
 * @param fixIssueIds - IDs of issues created by the audit.
 */
export function transitionToFixing(
  barfDir: string,
  fixIssueIds: string[],
): void {
  const gate = readAuditGate(barfDir)
  writeAuditGate(barfDir, {
    ...gate,
    state: 'fixing',
    auditFixIssueIds: fixIssueIds,
  })
  logger.info(
    { fixIssueCount: fixIssueIds.length },
    'audit gate transitioned to fixing',
  )
}
