import pino from 'pino';

/**
 * Create a named child logger. Pass the module name so log lines are
 * attributable: createLogger('LocalIssueProvider').
 *
 * Always writes structured JSON to stderr.
 * For human-readable output: LOG_PRETTY=1 barf <command>
 * (pipes internally through pino-pretty transport)
 */
export function createLogger(name: string): pino.Logger {
  const level = process.env.LOG_LEVEL ?? 'info';
  const dest = pino.destination(2); // stderr

  if (process.env.LOG_PRETTY === '1') {
    try {
      return pino(
        { name, level },
        pino.transport({ target: 'pino-pretty', options: { colorize: true, destination: 2 } }),
      );
    } catch {
      // pino-pretty not available (e.g. compiled binary without it bundled) — fall through
    }
  }

  return pino({ name, level }, dest);
}

/** Root logger for src/index.ts and top-level use. */
export const logger = createLogger('barf');
