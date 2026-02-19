import type { IssueProvider } from '@/core/issue-providers/base'
import type { Config } from '@/types/index'
import { runLoop } from '@/core/batch'
import { createLogger } from '@/utils/logger'

const logger = createLogger('plan')

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
