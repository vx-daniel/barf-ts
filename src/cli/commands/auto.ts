import type { Config } from '@/types'
import type { IssueProvider } from '@/core/issue-providers/base'
import { runLoop } from '@/core/batch'

const PLAN_STATES = new Set(['NEW'])
const BUILD_STATES = new Set(['PLANNED', 'IN_PROGRESS'])

export async function autoCommand(
  provider: IssueProvider,
  opts: { batch: number; max: number },
  config: Config
): Promise<void> {
  while (true) {
    const listResult = await provider.listIssues()
    if (listResult.isErr()) break

    const issues = listResult.value
    const toPlan = issues.filter(i => PLAN_STATES.has(i.state))
    const toBuild = issues.filter(i => BUILD_STATES.has(i.state)).slice(0, opts.batch)

    if (toPlan.length === 0 && toBuild.length === 0) break

    for (const issue of toPlan) {
      await runLoop(issue.id, 'plan', config, provider)
    }

    if (toBuild.length > 0) {
      await Promise.allSettled(toBuild.map(i => runLoop(i.id, 'build', config, provider)))
    }
  }
}
