import { describe, it, expect } from 'bun:test'
import { shouldContinue, handleOverflow } from '@/core/batch'
import { type Config, ConfigSchema } from '@/types'

const defaultConfig = (): Config => ConfigSchema.parse({})

describe('shouldContinue', () => {
  it('returns true when maxIterations=0 (unlimited)', () => {
    expect(shouldContinue(999, defaultConfig())).toBe(true)
  })

  it('returns false when iteration >= maxIterations', () => {
    const config = { ...defaultConfig(), maxIterations: 3 }
    expect(shouldContinue(3, config)).toBe(false)
  })

  it('returns true when iteration < maxIterations', () => {
    const config = { ...defaultConfig(), maxIterations: 3 }
    expect(shouldContinue(2, config)).toBe(true)
  })
})

describe('handleOverflow', () => {
  it('returns split when split_count < maxAutoSplits', () => {
    const result = handleOverflow(0, defaultConfig()) // default maxAutoSplits=3
    expect(result.action).toBe('split')
    expect(result.nextModel).toBe(defaultConfig().splitModel)
  })

  it('returns escalate when split_count >= maxAutoSplits', () => {
    const config = { ...defaultConfig(), maxAutoSplits: 3 }
    const result = handleOverflow(3, config)
    expect(result.action).toBe('escalate')
    expect(result.nextModel).toBe(config.extendedContextModel)
  })

  it('uses splitModel from config for split decision', () => {
    const config = { ...defaultConfig(), splitModel: 'claude-sonnet-4-6' }
    expect(handleOverflow(0, config).nextModel).toBe('claude-sonnet-4-6')
  })

  it('uses extendedContextModel from config for escalate decision', () => {
    const config = {
      ...defaultConfig(),
      maxAutoSplits: 1,
      extendedContextModel: 'claude-opus-4-6'
    }
    expect(handleOverflow(1, config).nextModel).toBe('claude-opus-4-6')
  })
})
