/** @module CLI Commands */
import type { IssueProvider } from '@/core/issue/base'
import { triageIssue } from '@/core/triage'
import type { Config } from '@/types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('triage-cmd')

/**
 * Runs triage on a single issue by ID.
 *
 * Wraps {@link triageIssue} as a CLI-invocable command. Used by the dashboard
 * to triage individual issues via SSE stream.
 *
 * @param provider - Issue provider for reading/writing issues.
 * @param opts - Must include `issue` ID to triage.
 * @param config - Loaded barf configuration.
 */
export async function triageCommand(
  provider: IssueProvider,
  opts: { issue: string },
  config: Config,
): Promise<void> {
  const result = await triageIssue(opts.issue, config, provider)
  if (result.isErr()) {
    logger.error({ issueId: opts.issue, err: result.error.message }, 'triage failed')
    process.exitCode = 1
    return
  }
  logger.info({ issueId: opts.issue }, 'triage complete')
}
