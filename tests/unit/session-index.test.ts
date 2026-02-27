import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import {
  makeAutoSessionId,
  makeSessionId,
  writeAutoEnd,
  writeAutoStart,
  writeSessionArchive,
  writeSessionDelete,
  writeSessionEnd,
  writeSessionStart,
} from '@/core/batch/session-index'

const TEST_DIR = join(import.meta.dir, '..', '.tmp-session-test')

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

function readIndex(): object[] {
  const content = readFileSync(join(TEST_DIR, 'sessions.jsonl'), 'utf8')
  return content
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
}

describe('session index', () => {
  it('should generate session IDs with issue prefix', () => {
    const id = makeSessionId('001')
    expect(id).toMatch(/^001-\d+$/)
  })

  it('should generate auto session IDs', () => {
    const id = makeAutoSessionId()
    expect(id).toMatch(/^auto-\d+$/)
  })

  it('should write start and end events', () => {
    writeSessionStart(TEST_DIR, 'test-123', '001', 'build', 'claude-sonnet-4-6', undefined)
    writeSessionEnd(TEST_DIR, 'test-123', undefined, 1000, 500, 3, 60)

    const events = readIndex()
    expect(events).toHaveLength(2)

    const start = events[0] as Record<string, unknown>
    expect(start.event).toBe('start')
    expect(start.sessionId).toBe('test-123')
    expect(start.issueId).toBe('001')
    expect(start.mode).toBe('build')
    expect(start.pid).toBe(process.pid)

    const end = events[1] as Record<string, unknown>
    expect(end.event).toBe('end')
    expect(end.sessionId).toBe('test-123')
    expect(end.inputTokens).toBe(1000)
    expect(end.outputTokens).toBe(500)
    expect(end.iterations).toBe(3)
    expect(end.durationSeconds).toBe(60)
  })

  it('should write auto start and end events', () => {
    writeAutoStart(TEST_DIR, 'auto-123')
    writeAutoEnd(TEST_DIR, 'auto-123', 5)

    const events = readIndex()
    expect(events).toHaveLength(2)

    const start = events[0] as Record<string, unknown>
    expect(start.event).toBe('auto_start')

    const end = events[1] as Record<string, unknown>
    expect(end.event).toBe('auto_end')
    expect(end.issueCount).toBe(5)
  })

  it('should write parentSessionId when provided', () => {
    writeSessionStart(
      TEST_DIR,
      'child-1',
      '001',
      'build',
      'claude-sonnet-4-6',
      undefined,
      'auto-parent',
    )

    const events = readIndex()
    const start = events[0] as Record<string, unknown>
    expect(start.parentSessionId).toBe('auto-parent')
  })

  it('should write delete events', () => {
    writeSessionStart(TEST_DIR, 'del-1', '001', 'build', 'claude-sonnet-4-6', undefined)
    writeSessionEnd(TEST_DIR, 'del-1', undefined, 100, 50, 1, 10)
    writeSessionDelete(TEST_DIR, 'del-1')

    const events = readIndex()
    expect(events).toHaveLength(3)

    const del = events[2] as Record<string, unknown>
    expect(del.event).toBe('delete')
    expect(del.sessionId).toBe('del-1')
    expect(del.timestamp).toBeDefined()
  })

  it('should write archive events', () => {
    writeSessionStart(TEST_DIR, 'arc-1', '002', 'plan', 'claude-sonnet-4-6', undefined)
    writeSessionEnd(TEST_DIR, 'arc-1', undefined, 200, 100, 2, 30)
    writeSessionArchive(TEST_DIR, 'arc-1')

    const events = readIndex()
    expect(events).toHaveLength(3)

    const arc = events[2] as Record<string, unknown>
    expect(arc.event).toBe('archive')
    expect(arc.sessionId).toBe('arc-1')
    expect(arc.timestamp).toBeDefined()
  })
})
