import type { IssueProvider } from '@/core/issue-providers/base'
import { createLogger } from '@/utils/logger'

const logger = createLogger('status')

export async function statusCommand(
  provider: IssueProvider,
  opts: { format: 'text' | 'json' }
): Promise<void> {
  const result = await provider.listIssues()
  if (result.isErr()) {
    logger.error({ err: result.error }, result.error.message)
    process.exit(1)
  }
  const issues = result.value
  if (opts.format === 'json') {
    logger.info({ issues }, 'Issues')
    return
  }
  if (issues.length === 0) {
    logger.info('No issues found.')
    return
  }
  for (const issue of issues) {
    logger.info({ state: issue.state, id: issue.id, title: issue.title }, 'Issue')
  }
}
