import type { IssueProvider } from '@/core/issue/base'
import type { Config } from '@/types'
import { interviewLoop } from '@/core/interview'
import { createLogger } from '@/utils/logger'

const logger = createLogger('interview')

/**
 * Runs the interactive interview workflow for an issue (NEW → INTERVIEWING → PLANNED).
 *
 * When `opts.issue` is omitted, auto-selects the highest-priority NEW issue via
 * {@link IssueProvider.autoSelect}. The issue is transitioned to INTERVIEWING before
 * the interview loop starts, then to PLANNED on completion.
 *
 * @param provider - Issue provider supplying and persisting issues.
 * @param opts - `issue`: explicit issue ID; omit to auto-select.
 * @param config - Loaded barf configuration (model, dirs, etc.).
 */
export async function interviewCommand(
  provider: IssueProvider,
  opts: { issue?: string },
  config: Config
): Promise<void> {
  let issueId = opts.issue

  if (!issueId) {
    const result = await provider.autoSelect('interview')
    if (result.isErr()) {
      logger.error({ err: result.error }, result.error.message)
      process.exitCode = 1
      return
    }
    if (!result.value) {
      logger.info('No NEW issues available for interview.')
      return
    }
    issueId = result.value.id
  }

  logger.info({ issueId }, 'starting interview')

  // NEW → INTERVIEWING
  const startTransition = await provider.transition(issueId, 'INTERVIEWING')
  if (startTransition.isErr()) {
    logger.error({ issueId, err: startTransition.error.message }, 'failed to start interview')
    process.exitCode = 1
    return
  }

  // Run the interactive interview loop
  const loopResult = await interviewLoop(issueId, config, provider)
  if (loopResult.isErr()) {
    logger.error({ issueId, err: loopResult.error.message }, 'interview loop failed')
    process.exitCode = 1
    return
  }

  // INTERVIEWING → PLANNED
  const endTransition = await provider.transition(issueId, 'PLANNED')
  if (endTransition.isErr()) {
    logger.error({ issueId, err: endTransition.error.message }, 'failed to complete interview')
    process.exitCode = 1
    return
  }

  logger.info({ issueId }, 'interview complete — issue is now PLANNED')
}
