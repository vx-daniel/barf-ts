import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Create a named child logger. Pass the module name so log lines are
 * attributable: createLogger('LocalIssueProvider').
 *
 * In dev: pretty-printed to stderr via pino-pretty.
 * In prod (compiled binary): structured JSON to stderr.
 */
export function createLogger(name: string): pino.Logger {
  return pino(
    {
      name,
      level: process.env.LOG_LEVEL ?? 'info',
    },
    isDev
      ? pino.transport({ target: 'pino-pretty', options: { colorize: true, destination: 2 } })
      : pino.destination(2), // stderr
  );
}

/** Root logger for src/index.ts and top-level use. */
export const logger = createLogger('barf');
