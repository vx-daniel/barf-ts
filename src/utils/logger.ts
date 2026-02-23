import pino from 'pino'
import type { Config } from '@/types/index'

/** Subset of {@link Config} consumed by the logger. */
type LoggerConfig = Pick<Config, 'logFile' | 'logLevel' | 'logPretty'>

let _loggerConfig: LoggerConfig | null = null

/**
 * Injects runtime config into the logger subsystem.
 *
 * Must be called in the `preAction` hook (after `process.chdir()`) so that
 * `logFile` resolves relative to the correct working directory. Priority for
 * each setting: config value → environment variable → built-in default.
 *
 * @param config - Logger-relevant slice of the loaded {@link Config}.
 */
export function setLoggerConfig(config: LoggerConfig): void {
  _loggerConfig = config
}

function buildLogger(name: string): pino.Logger {
  const level = _loggerConfig?.logLevel ?? process.env.LOG_LEVEL ?? 'info'
  const pretty = _loggerConfig?.logPretty ?? process.env.LOG_PRETTY === '1'
  const logFile = _loggerConfig?.logFile ?? process.env.BARF_LOG_FILE ?? 'barf.log'

  if (pretty) {
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
    { stream: pino.destination(logFile) }
  ]
  if (!process.stderr.isTTY) {
    destinations.unshift({ stream: pino.destination(2) })
  }
  const streams = pino.multistream(destinations)
  return pino({ name, level }, streams)
}

/**
 * Create a named child logger. The underlying pino instance is built lazily
 * on first use so that the log file path resolves after `--cwd` / `process.chdir()`.
 *
 * Priority for each setting: {@link setLoggerConfig} value → env var → default.
 * Environment overrides: `LOG_LEVEL`, `LOG_PRETTY=1`, `BARF_LOG_FILE=/abs/path`.
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
