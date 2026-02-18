import type { IssueProvider } from '../../core/issue-providers/base.js';

export async function statusCommand(
  provider: IssueProvider,
  opts: { format: 'text' | 'json' },
): Promise<void> {
  const result = await provider.listIssues();
  if (result.isErr()) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }
  const issues = result.value;
  if (opts.format === 'json') {
    console.log(JSON.stringify(issues, null, 2));
    return;
  }
  if (issues.length === 0) {
    console.log('No issues found.');
    return;
  }
  for (const issue of issues) {
    console.log(`[${issue.state.padEnd(11)}] ${issue.id} — ${issue.title}`);
  }
}
