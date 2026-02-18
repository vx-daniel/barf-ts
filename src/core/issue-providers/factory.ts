import { Result, ok, err } from 'neverthrow'
import type { Config } from '../../types/index.js'
import { IssueProvider } from './base.js'
import { LocalIssueProvider } from './local.js'
import { GitHubIssueProvider } from './github.js'

/**
 * Instantiates the issue provider selected in `config.issueProvider`.
 *
 * @returns `err` if `issueProvider` is `'github'` and `githubRepo` is not set.
 */
export function createIssueProvider(config: Config): Result<IssueProvider, Error> {
  switch (config.issueProvider) {
    case 'github':
      if (!config.githubRepo)
        {return err(new Error('GITHUB_REPO required when ISSUE_PROVIDER=github'))}
      return ok(new GitHubIssueProvider(config.githubRepo))
    case 'local':
    default:
      return ok(new LocalIssueProvider(config.issuesDir))
  }
}
