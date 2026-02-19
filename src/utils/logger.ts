import pino from 'pino'

/**
 * Returns the log file path, resolved at call time (not import time).
 * Override with BARF_LOG_FILE. Default: barf.log in the current working directory.
 */
function resolveLogFile(): string {
  return process.env.BARF_LOG_FILE ?? 'barf.log'
}

function buildLogger(name: string): pino.Logger {
  const level = process.env.LOG_LEVEL ?? 'info'

  if (process.env.LOG_PRETTY === '1') {
    try {
      return pino(
        { name, level },
        pino.transport({ target: 'pino-pretty', options: { colorize: true, destination: 2 } })
      )
    } catch {
      // pino-pretty not available in compiled binary — fall through
    }
  }

  const destinations: Parameters<typeof pino.multistream>[0] = [
    { stream: pino.destination(resolveLogFile()) }
  ]
  if (!process.stderr.isTTY) {
    destinations.unshift({ stream: pino.destination(2) })
  }
  const streams = pino.multistream(destinations)
  return pino({ name, level }, streams)
}

/**
 * Create a named child logger. The underlying pino instance is built lazily
 * on first use so that the log file path resolves after --cwd / process.chdir().
 *
 * Writes JSON to both stderr and `barf.log` in the project directory.
 * Overrides: LOG_LEVEL, LOG_PRETTY=1, BARF_LOG_FILE=/abs/path
 *
 * @category Utilities
 */
export function createLogger(name: string): pino.Logger {
  let instance: pino.Logger | null = null
  const get = () => (instance ??= buildLogger(name))
  return new Proxy({} as pino.Logger, {
    get: (_t, prop) => {
      const val = get()[prop as keyof pino.Logger]
      return typeof val === 'function' ? (val as Function).bind(get()) : val
    }
  })
}

/**
 * Root logger for src/index.ts and top-level use.
 *
 * @category Utilities
 */
export const logger = createLogger('barf')
