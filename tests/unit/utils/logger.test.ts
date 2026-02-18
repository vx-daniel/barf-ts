import { describe, it, expect } from 'bun:test';
import { createLogger } from '../../../src/utils/logger';

describe('createLogger', () => {
  it('creates a logger with the given name', () => {
    const log = createLogger('test');
    expect(log.bindings().name).toBe('test');
  });

  it('respects LOG_LEVEL env override', () => {
    process.env.LOG_LEVEL = 'warn';
    const log = createLogger('test');
    expect(log.level).toBe('warn');
    delete process.env.LOG_LEVEL;
  });

  it('defaults to info level', () => {
    delete process.env.LOG_LEVEL;
    const log = createLogger('test');
    expect(log.level).toBe('info');
  });
});
