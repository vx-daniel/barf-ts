import { resolve } from 'path'
import { Command } from 'commander'
import { loadConfig } from '@/core/config'
import { createIssueProvider } from '@/core/issue/factory'
import { logger, setLoggerConfig } from '@/utils/logger'
import {
  auditCommand,
  autoCommand,
  buildCommand,
  initCommand,
  planCommand,
  statusCommand,
} from '@/cli/commands'

/**
 * Creates the issue provider for `config`.
 *
 * Calls {@link createIssueProvider} and unwraps the result.
 * Logs the error and exits with code 1 if the provider type is
 * unrecognised or misconfigured.
 *
 * @param config - Loaded barf configuration.
 */
function getProvider(config: ReturnType<typeof loadConfig>) {
  return createIssueProvider(config).match(
    (p) => p,
    (e) => {
      logger.error({ err: e }, e.message)
      process.exit(1)
    },
  )
}

const program = new Command()
program
  .name('barf')
  .description('AI issue orchestration CLI')
  .version('2.0.0')
  .option('--cwd <path>', 'Project directory (default: current directory)')
  .option(
    '--config <path>',
    'Path to .barfrc config file (default: <cwd>/.barfrc)',
  )
  .hook('preAction', () => {
    const opts = program.opts()
    // Resolve --config to absolute before chdir so it isn't re-interpreted
    // relative to the new working directory
    if (opts.config) {
      program.setOptionValue('config', resolve(opts.config))
    }
    if (opts.cwd) {
      process.chdir(resolve(opts.cwd))
    }
    setLoggerConfig(loadConfig(program.opts().config))
  })

program
  .command('init')
  .description('Initialize barf in current project')
  .option('--provider <type>', 'Issue provider: local | github', 'local')
  .option(
    '--repo <owner/repo>',
    'GitHub repo (required when --provider=github)',
  )
  .action(async (opts) => {
    const config = loadConfig(program.opts().config)
    if (opts.provider) {
      config.issueProvider = opts.provider
    }
    if (opts.repo) {
      config.githubRepo = opts.repo
    }
    const issues = getProvider(config)
    await initCommand(issues, config)
  })

program
  .command('status')
  .description('List all issues and their states')
  .option('--format <fmt>', 'Output format: text | json', 'text')
  .action(async (opts) => {
    const config = loadConfig(program.opts().config)
    const issues = getProvider(config)
    await statusCommand(issues, { format: opts.format })
  })

program
  .command('plan')
  .description('Plan an issue with Claude AI (NEW → PLANNED)')
  .option(
    '--issue <id>',
    'Issue ID to plan (auto-selects INTERVIEWING issue if omitted)',
  )
  .action(async (opts) => {
    const config = loadConfig(program.opts().config)
    const provider = getProvider(config)
    await planCommand(provider, { issue: opts.issue }, config)
  })

program
  .command('build')
  .description('Build an issue with Claude AI (PLANNED → COMPLETED)')
  .option('--issue <id>', 'Issue ID to build (auto-selects if omitted)')
  .option('--batch <n>', 'Number of issues to build concurrently', parseInt)
  .option('--max <n>', 'Max iterations per issue (0 = unlimited)', parseInt)
  .action(async (opts) => {
    const config = loadConfig(program.opts().config)
    const provider = getProvider(config)
    await buildCommand(
      provider,
      { issue: opts.issue, batch: opts.batch ?? 1, max: opts.max ?? 0 },
      config,
    )
  })

program
  .command('auto')
  .description(
    'Auto-orchestrate: triage NEW, plan triaged, build PLANNED/IN_PROGRESS',
  )
  .option('--batch <n>', 'Max concurrent builds', parseInt)
  .option('--max <n>', 'Max iterations per issue (0 = unlimited)', parseInt)
  .action(async (opts) => {
    const config = loadConfig(program.opts().config)
    const provider = getProvider(config)
    await autoCommand(
      provider,
      { batch: opts.batch ?? 1, max: opts.max ?? 0 },
      config,
    )
  })

program
  .command('audit')
  .description('Audit completed issues for quality and rule compliance')
  .option('--issue <id>', 'Issue ID to audit (default: all COMPLETED issues)')
  .option('--all', 'Audit all COMPLETED issues (default behaviour)', false)
  .action(async (opts) => {
    const config = loadConfig(program.opts().config)
    const provider = getProvider(config)
    await auditCommand(provider, { issue: opts.issue, all: opts.all }, config)
  })

program.parseAsync(process.argv)
