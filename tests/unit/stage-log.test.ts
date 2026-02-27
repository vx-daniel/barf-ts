import { describe, expect, it } from 'bun:test'
import {
  formatStageLogEntry,
  type StageLogEntry,
} from '@/types/schema/session-stats-schema'

describe('formatStageLogEntry', () => {
  const baseEntry: StageLogEntry = {
    fromState: 'PLANNED',
    toState: 'IN_PROGRESS',
    timestamp: '2026-02-27T14:01:07.000Z',
    durationInStageSeconds: 12,
    inputTokens: 1500,
    outputTokens: 450,
    finalContextSize: 1200,
    iterations: 1,
    model: 'claude-opus-4-6',
    trigger: 'auto/build',
  }

  it('formats a stage log entry as markdown', () => {
    const result = formatStageLogEntry(baseEntry)
    expect(result).toContain('### IN_PROGRESS — 2026-02-27 14:01:07Z')
    expect(result).toContain('- **From:** PLANNED')
    expect(result).toContain('- **Duration in stage:** 12s')
    expect(result).toContain('- **Input tokens:** 1,500 (final context: 1,200)')
    expect(result).toContain('- **Output tokens:** 450')
    expect(result).toContain('- **Iterations:** 1')
    expect(result).toContain('- **Model:** claude-opus-4-6')
    expect(result).toContain('- **Trigger:** auto/build')
  })

  it('includes context usage when provided', () => {
    const entry: StageLogEntry = { ...baseEntry, contextUsagePercent: 42 }
    const result = formatStageLogEntry(entry)
    expect(result).toContain('- **Context used:** 42%')
  })

  it('omits context usage when undefined', () => {
    const result = formatStageLogEntry(baseEntry)
    expect(result).not.toContain('Context used')
  })
})
