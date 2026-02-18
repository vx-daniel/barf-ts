import type { IssueProvider } from '@/core/issue-providers/base'
import type { Config } from '@/types/index'
import { runLoop } from '@/core/batch'

export async function planCommand(
  provider: IssueProvider,
  opts: { issue?: string },
  config: Config
): Promise<void> {
  let issueId = opts.issue

  if (!issueId) {
    const result = await provider.autoSelect('plan')
    if (result.isErr()) {
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }
    if (!result.value) {
      console.info('No issues available for planning (no NEW issues found).')
      return
    }
    issueId = result.value.id
  }

  console.info(`Planning issue ${issueId}...`)
  const result = await runLoop(issueId, 'plan', config, provider)
  if (result.isErr()) {
    console.error(`Error: ${result.error.message}`)
    process.exit(1)
  }
  console.info(`Issue ${issueId} planned.`)
}
