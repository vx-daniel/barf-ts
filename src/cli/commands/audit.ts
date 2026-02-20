import { join } from 'path'
import { existsSync, readFileSync, readdirSync } from 'fs'
import type { IssueProvider } from '@/core/issue/base'
import type { Config } from '@/types'
import { runClaudeIteration } from '@/core/claude'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'

// Embedded at compile time via Bun import attribute
import auditPromptTemplate from '@/prompts/PROMPT_audit.md' with { type: 'text' }

const logger = createLogger('audit')

/**
 * Injects audit-specific template variables into a prompt string.
 *
 * @param template - Raw audit prompt template with `$BARF_*` placeholders.
 * @param vars - Values to substitute.
 * @returns Prompt with all placeholders replaced.
 */
function injectAuditVars(
  template: string,
  vars: {
    issueId: string
    issueFile: string
    planFile: string
    issuesDir: string
    testResults: string
    lintResults: string
    formatResults: string
    rulesContext: string
  }
): string {
  return template
    .replace(/\$\{?BARF_ISSUE_ID\}?/g, vars.issueId)
    .replace(/\$\{?BARF_ISSUE_FILE\}?/g, vars.issueFile)
    .replace(/\$\{?PLAN_FILE\}?/g, vars.planFile)
    .replace(/\$\{?ISSUES_DIR\}?/g, vars.issuesDir)
    .replace(/\$\{?TEST_RESULTS\}?/g, vars.testResults)
    .replace(/\$\{?LINT_RESULTS\}?/g, vars.lintResults)
    .replace(/\$\{?FORMAT_RESULTS\}?/g, vars.formatResults)
    .replace(/\$\{?RULES_CONTEXT\}?/g, vars.rulesContext)
}

/**
 * Loads project rules from CLAUDE.md and `.claude/rules/` for inclusion in the audit prompt.
 * Returns a concatenated string of all rule files found.
 */
function loadRulesContext(): string {
  const parts: string[] = []

  if (existsSync('CLAUDE.md')) {
    parts.push(`## CLAUDE.md\n\n${readFileSync('CLAUDE.md', 'utf-8')}`)
  }

  if (existsSync('.claude/rules')) {
    for (const file of readdirSync('.claude/rules').filter(f => f.endsWith('.md'))) {
      const content = readFileSync(join('.claude/rules', file), 'utf-8')
      parts.push(`## ${file}\n\n${content}`)
    }
  }

  return parts.length > 0 ? parts.join('\n\n---\n\n') : '(no project rules found)'
}

/**
 * Formats a subprocess result as a human-readable audit context string.
 *
 * @param result - Result from `execFileNoThrow`, or `null` if the check was skipped.
 * @returns A string describing pass/fail status and captured output.
 */
function formatCheckResult(
  result: { stdout: string; stderr: string; status: number } | null
): string {
  if (result === null) {
    return '(skipped — not configured)'
  }
  const status = result.status === 0 ? 'PASS' : `FAIL (exit ${result.status})`
  const output = (result.stdout + result.stderr).trim()
  return output ? `${status}\n${output}` : status
}

/**
 * Audits a single COMPLETED issue by running deterministic checks and an AI review.
 *
 * Phase 1: runs tests, lint, and format check via `execFileNoThrow`.
 * Phase 2: runs Claude with the audit prompt, including check results and project rules.
 *
 * If Claude finds issues, it creates a new issue file in `config.issuesDir` with findings.
 * If everything passes, logs a success message.
 *
 * @param issueId - ID of the completed issue to audit.
 * @param config - Loaded barf configuration.
 * @param provider - Issue provider for reading issues.
 */
async function auditIssue(issueId: string, config: Config, provider: IssueProvider): Promise<void> {
  const issueResult = await provider.fetchIssue(issueId)
  if (issueResult.isErr()) {
    logger.error({ issueId, err: issueResult.error.message }, 'could not fetch issue')
    process.exitCode = 1
    return
  }

  const issue = issueResult.value
  if (issue.state !== 'COMPLETED') {
    logger.warn({ issueId, state: issue.state }, 'skipping — issue is not COMPLETED')
    return
  }

  logger.info({ issueId }, 'auditing issue')

  // ── Phase 1: deterministic checks ─────────────────────────────────────────

  const [testResult, lintResult, fmtResult] = await Promise.all([
    config.testCommand ? execFileNoThrow('sh', ['-c', config.testCommand]) : Promise.resolve(null),
    execFileNoThrow('bun', ['run', 'lint']),
    execFileNoThrow('bun', ['run', 'format:check'])
  ])

  // ── Phase 2: AI audit ──────────────────────────────────────────────────────

  const issueFile = join(config.issuesDir, `${issueId}.md`)
  const planFilePath = join(config.planDir, `${issueId}.md`)
  const planFile = existsSync(planFilePath)
    ? readFileSync(planFilePath, 'utf-8')
    : '(no plan file found)'

  const rulesContext = loadRulesContext()

  // Record existing issue IDs so we can detect new files created by Claude
  const existingIds = new Set(
    existsSync(config.issuesDir)
      ? readdirSync(config.issuesDir)
          .filter(f => f.endsWith('.md'))
          .map(f => f.replace(/\.md$/, ''))
      : []
  )

  const prompt = injectAuditVars(auditPromptTemplate, {
    issueId,
    issueFile,
    planFile,
    issuesDir: config.issuesDir,
    testResults: formatCheckResult(testResult),
    lintResults: formatCheckResult(lintResult),
    formatResults: formatCheckResult(fmtResult),
    rulesContext
  })

  const iterResult = await runClaudeIteration(prompt, config.auditModel, config, issueId)
  if (iterResult.isErr()) {
    logger.error({ issueId, err: iterResult.error.message }, 'audit Claude run failed')
    process.exitCode = 1
    return
  }

  if (iterResult.value.outcome === 'rate_limited') {
    const resetsAt = iterResult.value.rateLimitResetsAt
    const timeStr = resetsAt ? new Date(resetsAt * 1000).toLocaleTimeString() : 'soon'
    logger.error({ issueId }, `rate limited until ${timeStr}`)
    process.exitCode = 1
    return
  }

  // Check whether Claude created a new issue file (audit findings)
  const newIds = existsSync(config.issuesDir)
    ? readdirSync(config.issuesDir)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace(/\.md$/, ''))
        .filter(id => !existingIds.has(id))
    : []

  if (newIds.length > 0) {
    logger.warn({ issueId, findingsIssues: newIds }, 'audit found issues — new issue(s) created')
    for (const id of newIds) {
      process.stdout.write(`✗ Issue #${issueId}: findings written to #${id}\n`)
    }
    process.exitCode = 1
  } else {
    process.stdout.write(`✓ Issue #${issueId} passes audit\n`)
    logger.info({ issueId }, 'audit passed')
  }
}

/**
 * Audits one or all COMPLETED issues.
 *
 * Default behaviour (`--all` or no flags): audits all COMPLETED issues.
 * `--issue <id>`: audits only the named issue.
 *
 * @param provider - Issue provider for listing and reading issues.
 * @param opts - `issue`: explicit issue ID; `all`: audit all COMPLETED issues.
 * @param config - Loaded barf configuration.
 */
export async function auditCommand(
  provider: IssueProvider,
  opts: { issue?: string; all: boolean },
  config: Config
): Promise<void> {
  if (opts.issue) {
    await auditIssue(opts.issue, config, provider)
    return
  }

  // Default: audit all COMPLETED issues
  const listResult = await provider.listIssues({ state: 'COMPLETED' })
  if (listResult.isErr()) {
    logger.error({ err: listResult.error }, listResult.error.message)
    process.exitCode = 1
    return
  }

  const completed = listResult.value
  if (completed.length === 0) {
    logger.info('No COMPLETED issues to audit.')
    return
  }

  logger.info({ count: completed.length }, 'auditing COMPLETED issues')

  for (const issue of completed) {
    await auditIssue(issue.id, config, provider)
  }
}
