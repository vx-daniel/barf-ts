import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  cancelAuditGate,
  checkAutoTrigger,
  incrementCompleted,
  readAuditGate,
  resetAuditGate,
  transitionToAuditing,
  transitionToFixing,
  triggerAuditGate,
  writeAuditGate,
} from '@/core/batch/audit-gate'
import type { AuditGate, Config } from '@/types'
import { ConfigSchema } from '@/types/schema/config-schema'

const TEST_DIR = join(import.meta.dir, '..', '.tmp-audit-gate-test')

function makeConfig(overrides: Partial<Config> = {}): Config {
  return ConfigSchema.parse({ barfDir: TEST_DIR, ...overrides })
}

describe('audit-gate', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('readAuditGate', () => {
    it('returns default running state when file does not exist', () => {
      const gate = readAuditGate(TEST_DIR)
      expect(gate.state).toBe('running')
      expect(gate.completedSinceLastAudit).toBe(0)
      expect(gate.auditFixIssueIds).toEqual([])
    })

    it('parses existing gate file', () => {
      const data: AuditGate = {
        state: 'fixing',
        triggeredBy: 'dashboard',
        triggeredAt: '2026-02-27T00:00:00.000Z',
        completedSinceLastAudit: 5,
        auditFixIssueIds: ['fix-1', 'fix-2'],
      }
      writeFileSync(
        join(TEST_DIR, 'audit-gate.json'),
        JSON.stringify(data),
      )
      const gate = readAuditGate(TEST_DIR)
      expect(gate.state).toBe('fixing')
      expect(gate.auditFixIssueIds).toEqual(['fix-1', 'fix-2'])
      expect(gate.completedSinceLastAudit).toBe(5)
    })

    it('returns default on corrupt file', () => {
      writeFileSync(join(TEST_DIR, 'audit-gate.json'), 'not json')
      const gate = readAuditGate(TEST_DIR)
      expect(gate.state).toBe('running')
    })
  })

  describe('writeAuditGate', () => {
    it('creates the file with formatted JSON', () => {
      const gate: AuditGate = {
        state: 'draining',
        completedSinceLastAudit: 3,
        auditFixIssueIds: [],
      }
      writeAuditGate(TEST_DIR, gate)
      const content = readFileSync(
        join(TEST_DIR, 'audit-gate.json'),
        'utf-8',
      )
      expect(JSON.parse(content)).toMatchObject({ state: 'draining' })
    })
  })

  describe('triggerAuditGate', () => {
    it('transitions from running to draining', () => {
      const triggered = triggerAuditGate(TEST_DIR, 'cli')
      expect(triggered).toBe(true)
      const gate = readAuditGate(TEST_DIR)
      expect(gate.state).toBe('draining')
      expect(gate.triggeredBy).toBe('cli')
      expect(gate.triggeredAt).toBeDefined()
    })

    it('returns false if already active', () => {
      triggerAuditGate(TEST_DIR, 'cli')
      const triggered = triggerAuditGate(TEST_DIR, 'dashboard')
      expect(triggered).toBe(false)
      expect(readAuditGate(TEST_DIR).triggeredBy).toBe('cli')
    })
  })

  describe('cancelAuditGate', () => {
    it('returns to running from any active state', () => {
      triggerAuditGate(TEST_DIR, 'auto')
      const cancelled = cancelAuditGate(TEST_DIR)
      expect(cancelled).toBe(true)
      expect(readAuditGate(TEST_DIR).state).toBe('running')
    })

    it('preserves completed counter on cancel', () => {
      incrementCompleted(TEST_DIR)
      incrementCompleted(TEST_DIR)
      triggerAuditGate(TEST_DIR, 'auto')
      cancelAuditGate(TEST_DIR)
      expect(readAuditGate(TEST_DIR).completedSinceLastAudit).toBe(2)
    })

    it('returns false if already running', () => {
      expect(cancelAuditGate(TEST_DIR)).toBe(false)
    })
  })

  describe('incrementCompleted', () => {
    it('increments the counter', () => {
      incrementCompleted(TEST_DIR)
      incrementCompleted(TEST_DIR)
      incrementCompleted(TEST_DIR)
      expect(readAuditGate(TEST_DIR).completedSinceLastAudit).toBe(3)
    })
  })

  describe('checkAutoTrigger', () => {
    it('returns true when counter reaches threshold', () => {
      const gate: AuditGate = {
        state: 'running',
        completedSinceLastAudit: 10,
        auditFixIssueIds: [],
      }
      const config = makeConfig({ auditAfterNCompleted: 10 })
      expect(checkAutoTrigger(gate, config)).toBe(true)
    })

    it('returns false when below threshold', () => {
      const gate: AuditGate = {
        state: 'running',
        completedSinceLastAudit: 9,
        auditFixIssueIds: [],
      }
      const config = makeConfig({ auditAfterNCompleted: 10 })
      expect(checkAutoTrigger(gate, config)).toBe(false)
    })

    it('returns false when disabled (threshold=0)', () => {
      const gate: AuditGate = {
        state: 'running',
        completedSinceLastAudit: 100,
        auditFixIssueIds: [],
      }
      const config = makeConfig({ auditAfterNCompleted: 0 })
      expect(checkAutoTrigger(gate, config)).toBe(false)
    })

    it('returns false when gate is not running', () => {
      const gate: AuditGate = {
        state: 'fixing',
        completedSinceLastAudit: 20,
        auditFixIssueIds: [],
      }
      const config = makeConfig({ auditAfterNCompleted: 10 })
      expect(checkAutoTrigger(gate, config)).toBe(false)
    })
  })

  describe('resetAuditGate', () => {
    it('resets to default running state', () => {
      triggerAuditGate(TEST_DIR, 'auto')
      transitionToFixing(TEST_DIR, ['fix-1'])
      resetAuditGate(TEST_DIR)
      const gate = readAuditGate(TEST_DIR)
      expect(gate.state).toBe('running')
      expect(gate.completedSinceLastAudit).toBe(0)
      expect(gate.auditFixIssueIds).toEqual([])
    })
  })

  describe('transitionToAuditing', () => {
    it('sets state to auditing', () => {
      triggerAuditGate(TEST_DIR, 'cli')
      transitionToAuditing(TEST_DIR)
      expect(readAuditGate(TEST_DIR).state).toBe('auditing')
    })
  })

  describe('transitionToFixing', () => {
    it('sets state to fixing with fix issue IDs', () => {
      transitionToFixing(TEST_DIR, ['fix-1', 'fix-2', 'fix-3'])
      const gate = readAuditGate(TEST_DIR)
      expect(gate.state).toBe('fixing')
      expect(gate.auditFixIssueIds).toEqual(['fix-1', 'fix-2', 'fix-3'])
    })
  })

  describe('state machine flow', () => {
    it('completes full cycle: running → draining → auditing → fixing → running', () => {
      // Start in running
      expect(readAuditGate(TEST_DIR).state).toBe('running')

      // Trigger → draining
      triggerAuditGate(TEST_DIR, 'dashboard')
      expect(readAuditGate(TEST_DIR).state).toBe('draining')

      // Drain complete → auditing
      transitionToAuditing(TEST_DIR)
      expect(readAuditGate(TEST_DIR).state).toBe('auditing')

      // Audit found issues → fixing
      transitionToFixing(TEST_DIR, ['fix-1'])
      expect(readAuditGate(TEST_DIR).state).toBe('fixing')

      // All fixes done → running
      resetAuditGate(TEST_DIR)
      expect(readAuditGate(TEST_DIR).state).toBe('running')
    })

    it('completes cycle with no findings: running → draining → auditing → running', () => {
      triggerAuditGate(TEST_DIR, 'auto')
      transitionToAuditing(TEST_DIR)
      // No findings — reset directly
      resetAuditGate(TEST_DIR)
      expect(readAuditGate(TEST_DIR).state).toBe('running')
    })
  })
})
