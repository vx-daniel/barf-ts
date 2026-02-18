import { Command } from 'commander';
import { loadConfig } from './core/config.js';
import { createIssueProvider } from './core/issue-providers/factory.js';
import { initCommand } from './cli/commands/init.js';
import { statusCommand } from './cli/commands/status.js';

function getProvider(config: ReturnType<typeof loadConfig>) {
  return createIssueProvider(config).match(
    (p) => p,
    (e) => { console.error(`Error: ${e.message}`); process.exit(1); }
  );
}

const program = new Command();
program.name('barf').description('AI issue orchestration CLI').version('2.0.0');

program
  .command('init')
  .description('Initialize barf in current project')
  .option('--provider <type>', 'Issue provider: local | github', 'local')
  .option('--repo <owner/repo>', 'GitHub repo (required when --provider=github)')
  .action(async (opts) => {
    const config = loadConfig();
    if (opts.provider) config.issueProvider = opts.provider;
    if (opts.repo) config.githubRepo = opts.repo;
    const issues = getProvider(config);
    await initCommand(issues, config);
  });

program
  .command('status')
  .description('List all issues and their states')
  .option('--format <fmt>', 'Output format: text | json', 'text')
  .action(async (opts) => {
    const config = loadConfig();
    const issues = getProvider(config);
    await statusCommand(issues, { format: opts.format });
  });

program.parseAsync(process.argv);
