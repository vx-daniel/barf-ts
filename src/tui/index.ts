import { createCliRenderer } from '@opentui/core'
import { appendFileSync } from 'node:fs'
import { tokyoNight } from '@/utils/themes'
import { loadConfig } from '@/core/config'
import { createIssueProvider } from '@/core/issue/factory'
import { App } from './app'

// ── Global error watcher ──────────────────────────────────────────────────────

const TUI_LOG = '/tmp/barf-tui.log'

/**
 * Writes a timestamped error entry to {@link TUI_LOG} and exits.
 *
 * Called before the process dies so that TUI crashes leave a readable
 * artifact even when the terminal is in raw/alternate-screen mode.
 */
function handleFatalError(label: string, err: unknown): void {
  const ts = new Date().toISOString()
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  try {
    appendFileSync(TUI_LOG, `[${ts}] ${label}: ${message}\n`)
  } catch {
    // If we can't write to the log, nothing more we can do.
  }
  process.exit(1)
}

process.on('uncaughtException', err => handleFatalError('uncaughtException', err))
process.on('unhandledRejection', reason => handleFatalError('unhandledRejection', reason))

// ── Theme colours ─────────────────────────────────────────────────────────────

const theme = tokyoNight

/**
 * Application-wide colour palette derived from the Tokyo Night theme.
 *
 * Exported so components can import it without circular deps — they import
 * from `@/tui/index` (this file) which has no runtime side-effects beyond
 * defining this object before App mounts.
 */
export const _APP_COLORS = {
  title: theme.color_14,
  subtitle: theme.color_13,
  dim: theme.color_08,
  border: theme.color_06,
  header: theme.color_01,
  headerAlt: theme.color_09,
  background: theme.background,
  sidebar: theme.color_01,
  red: theme.color_02,
  yellow: theme.color_04,
  green: theme.color_03,
  white: theme.foreground,
  orange: theme.color_12
} as const

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
