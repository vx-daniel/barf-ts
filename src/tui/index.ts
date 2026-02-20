import { createCliRenderer } from '@opentui/core'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { loadConfig } from '@/core/config'
import { createIssueProvider } from '@/core/issue/factory'
import { App } from './app'

// ── Global error watcher ──────────────────────────────────────────────────────

/**
 * Path to the TUI crash log.
 *
 * Initialised to `.barf/tui.log` relative to the startup cwd, then updated
 * to `{config.barfDir}/tui.log` once the working directory and config are known.
 */
let tuiLog = join(process.cwd(), '.barf', 'tui.log')

/**
 * Writes a timestamped error entry to {@link tuiLog} and exits.
 *
 * Called before the process dies so that TUI crashes leave a readable
 * artifact even when the terminal is in raw/alternate-screen mode.
 */
function handleFatalError(label: string, err: unknown): void {
  const ts = new Date().toISOString()
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  try {
    mkdirSync(dirname(tuiLog), { recursive: true })
    appendFileSync(tuiLog, `[${ts}] ${label}: ${message}\n`)
  } catch {
    // If we can't write to the log, nothing more we can do.
  }
  process.exit(1)
}

process.on('uncaughtException', err => handleFatalError('uncaughtException', err))
process.on('unhandledRejection', reason => handleFatalError('unhandledRejection', reason))

export { _APP_COLORS } from './colors'

// ── CLI arg parsing ───────────────────────────────────────────────────────────

function parseArgs(): { config?: string; cwd?: string } {
  const args = process.argv.slice(2)
  const result: { config?: string; cwd?: string } = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && i + 1 < args.length) {
      result.config = args[++i]
    } else if (args[i] === '--cwd' && i + 1 < args.length) {
      result.cwd = args[++i]
    }
  }

  return result
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const { config: configPath, cwd } = parseArgs()

if (cwd) {
  process.chdir(cwd)
}

const config = loadConfig(configPath)

// Now that cwd and barfDir are known, point the error log at the project's .barf folder.
tuiLog = join(process.cwd(), config.barfDir, 'tui.log')

const providerResult = createIssueProvider(config)
if (providerResult.isErr()) {
  process.stderr.write(`barf TUI: ${providerResult.error.message}\n`)
  process.exit(1)
}
const provider = providerResult.value

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
  onDestroy: () => {
    // Allow the process to exit naturally after cleanup
  }
})

const app = new App(renderer, config, provider)
app.mount()

// Initial data load
await app.refresh()
