import type { IssueProvider } from '@/core/issue-providers/base.js'
import type { Config } from '@/types/index'
import { runLoop } from '@/core/batch'

export async function buildCommand(
  provider: IssueProvider,
  opts: { issue?: string; batch: number; max: number },
  config: Config
): Promise<void> {
  // --max overrides config.maxIterations for this invocation only
  const effectiveConfig = opts.max > 0 ? { ...config, maxIterations: opts.max } : config

  if (opts.issue) {
    console.info(`Building issue ${opts.issue}...`)
    const result = await runLoop(opts.issue, 'build', effectiveConfig, provider)
    if (result.isErr()) {
      console.error(`Error: ${result.error.message}`)
      process.exit(1)
    }
    console.info(`Issue ${opts.issue} build complete.`)
    return
  }

  // Batch mode: pick up to opts.batch issues in priority order
  const listResult = await provider.listIssues()
  if (listResult.isErr()) {
    console.error(`Error: ${listResult.error.message}`)
    process.exit(1)
  }

  const BUILDABLE = new Set<string>(['IN_PROGRESS', 'PLANNED', 'NEW'])
  const candidates = listResult.value.filter(i => BUILDABLE.has(i.state)).slice(0, opts.batch)

  if (candidates.length === 0) {
    console.info('No issues available for building.')
    return
  }

  console.info(`Building ${candidates.length} issue(s) concurrently...`)

  const results = await Promise.allSettled(
    candidates.map(issue => runLoop(issue.id, 'build', effectiveConfig, provider))
  )

  let failures = 0
  for (const [i, r] of results.entries()) {
    const id = candidates[i]!.id
    if (r.status === 'rejected') {
      console.error(`  ✗ ${id}: ${r.reason}`)
      failures++
    } else if (r.value.isErr()) {
      console.error(`  ✗ ${id}: ${r.value.error.message}`)
      failures++
    } else {
      console.info(`  ✓ ${id}`)
    }
  }

  if (failures > 0) {
    process.exit(1)
  }
}
