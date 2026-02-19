import { resolve } from 'path'
import { Command } from 'commander'
import { loadConfig } from '@/core/config'
import { createIssueProvider } from '@/core/issue-providers/factory'
import { initCommand } from '@/cli/commands/init'
import { statusCommand } from '@/cli/commands/status'
import { planCommand } from '@/cli/commands/plan'
import { buildCommand } from '@/cli/commands/build'

function getProvider(config: ReturnType<typeof loadConfig>) {
  return createIssueProvider(config).match(
    p => p,
    e => {
      console.error(`Error: ${e.message}`)
      process.exit(1)
    }
  )
}

const program = new Command()
program
  .name('barf')
  .description('AI issue orchestration CLI')
  .version('2.0.0')
  .option('--cwd <path>', 'Project directory (default: current directory)')
  .option('--config <path>', 'Path to .barfrc config file (default: <cwd>/.barfrc)')
  .hook('preAction', () => {
    const cwd = program.opts().cwd
    if (cwd) process.chdir(resolve(cwd))
  })

program
  .command('init')
  .description('Initialize barf in current project')
  .option('--provider <type>', 'Issue provider: local | github', 'local')
  .option('--repo <owner/repo>', 'GitHub repo (required when --provider=github)')
  .action(async opts => {
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
  .action(async opts => {
    const config = loadConfig(program.opts().config)
    const issues = getProvider(config)
    await statusCommand(issues, { format: opts.format })
  })

program
  .command('plan')
  .description('Plan an issue with Claude AI (NEW → PLANNED)')
  .option('--issue <id>', 'Issue ID to plan (auto-selects NEW issue if omitted)')
  .action(async opts => {
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
  .action(async opts => {
    const config = loadConfig(program.opts().config)
    const provider = getProvider(config)
    await buildCommand(
      provider,
      { issue: opts.issue, batch: opts.batch ?? 1, max: opts.max ?? 0 },
      config
    )
  })

program.parseAsync(process.argv)
