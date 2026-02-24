import { describe, it, expect } from 'bun:test'
import {
  BarfModeSchema,
  LoopModeSchema,
  PromptModeSchema,
  AutoSelectModeSchema
} from '@/types/schema/mode-schema'

describe('BarfModeSchema', () => {
  it.each(['plan', 'build', 'split'])('accepts "%s"', mode => {
    expect(BarfModeSchema.safeParse(mode).success).toBe(true)
  })

  it('rejects "interview" (removed)', () => {
    expect(BarfModeSchema.safeParse('interview').success).toBe(false)
  })

  it('rejects invalid mode', () => {
    expect(BarfModeSchema.safeParse('deploy').success).toBe(false)
  })
})

describe('LoopModeSchema', () => {
  it.each(['plan', 'build', 'split'])('accepts "%s"', mode => {
    expect(LoopModeSchema.safeParse(mode).success).toBe(true)
  })

  it('rejects "interview"', () => {
    expect(LoopModeSchema.safeParse('interview').success).toBe(false)
  })
})

describe('PromptModeSchema', () => {
  it.each(['plan', 'build', 'split', 'audit', 'triage'])('accepts "%s"', mode => {
    expect(PromptModeSchema.safeParse(mode).success).toBe(true)
  })

  it('rejects "interview" (removed)', () => {
    expect(PromptModeSchema.safeParse('interview').success).toBe(false)
  })

  it('rejects invalid mode', () => {
    expect(PromptModeSchema.safeParse('deploy').success).toBe(false)
  })
})

describe('AutoSelectModeSchema', () => {
  it.each(['plan', 'build'])('accepts "%s"', mode => {
    expect(AutoSelectModeSchema.safeParse(mode).success).toBe(true)
  })

  it('rejects "interview" (removed)', () => {
    expect(AutoSelectModeSchema.safeParse('interview').success).toBe(false)
  })

  it('rejects "split"', () => {
    expect(AutoSelectModeSchema.safeParse('split').success).toBe(false)
  })
})
