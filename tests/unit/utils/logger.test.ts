import { describe, it, expect } from 'bun:test'
import { createLogger } from '@/utils/logger'

describe('createLogger', () => {
  it('creates a logger with the given name', () => {
    const log = createLogger('test')
    expect(log.bindings().name).toBe('test')
  })

  it('respects LOG_LEVEL env override', () => {
    process.env.LOG_LEVEL = 'warn'
    const log = createLogger('test')
    expect(log.level).toBe('warn')
    delete process.env.LOG_LEVEL
  })

  it('defaults to info level', () => {
    delete process.env.LOG_LEVEL
    const log = createLogger('test')
    expect(log.level).toBe('info')
  })

  it('falls through when LOG_PRETTY=1 and pino-pretty is available', () => {
    process.env.LOG_PRETTY = '1'
    const log = createLogger('pretty-test')
    // Should not throw — either pretty prints or falls through gracefully
    expect(log.bindings().name).toBe('pretty-test')
    delete process.env.LOG_PRETTY
  })

  it('exposes functional logger methods via proxy', () => {
    const log = createLogger('proxy-test')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.debug).toBe('function')
  })
})
