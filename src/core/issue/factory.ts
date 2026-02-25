import { type Result, ok, err } from 'neverthrow'
import type { Config } from '@/types'
import type { IssueProvider } from '@/core/issue/base'
import { LocalIssueProvider } from '@/core/issue/providers/local'
import { GitHubIssueProvider } from '@/core/issue/providers/github'

/**
 * Instantiates the issue provider selected in `config.issueProvider`.
 *
 * @param config - Loaded barf configuration; `issueProvider` and `githubRepo` are read here.
 * @returns `ok(IssueProvider)` on success, `err(Error)` if `issueProvider` is `'github'`
 *   and `githubRepo` is not set.
 * @category Issue Providers
 */
export function createIssueProvider(
  config: Config,
): Result<IssueProvider, Error> {
  switch (config.issueProvider) {
    case 'github':
      if (!config.githubRepo) {
        return err(new Error('GITHUB_REPO required when ISSUE_PROVIDER=github'))
      }
      return ok(new GitHubIssueProvider(config.githubRepo))
    default:
      return ok(new LocalIssueProvider(config.issuesDir, config.barfDir))
  }
}
