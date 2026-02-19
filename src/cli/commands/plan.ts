import type { IssueProvider } from '@/core/issue/base'
import type { Config } from '@/types/index'
import { runLoop } from '@/core/batch'
import { createLogger } from '@/utils/logger'

const logger = createLogger('plan')

/**
 * Plans a single issue (NEW → PLANNED) using Claude AI.
 *
 * When `opts.issue` is omitted, auto-selects the highest-priority NEW issue
 * via {@link IssueProvider.autoSelect}. Exits with code 1 if auto-selection
 * or the planning loop fails.
 *
 * @param provider - Issue provider supplying and persisting issues.
 * @param opts - `issue`: explicit issue ID to plan; omit to auto-select.
 * @param config - Loaded barf configuration (model, context threshold, etc.).
 */
export async function planCommand(
  provider: IssueProvider,
  opts: { issue?: string },
  config: Config
): Promise<void> {
  let issueId = opts.issue

  if (!issueId) {
    const result = await provider.autoSelect('plan')
    if (result.isErr()) {
      logger.error({ err: result.error }, result.error.message)
      process.exit(1)
    }
    if (!result.value) {
      logger.info('No issues available for planning (no NEW issues found).')
      return
    }
    issueId = result.value.id
  }

  logger.info({ issueId }, 'Planning issue')
  const result = await runLoop(issueId, 'plan', config, provider)
  if (result.isErr()) {
    logger.error({ err: result.error }, result.error.message)
    process.exit(1)
  }
  logger.info({ issueId }, 'Issue planned')
}
