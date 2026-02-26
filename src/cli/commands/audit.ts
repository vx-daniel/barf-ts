/** @module CLI Commands */
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { injectTemplateVars } from '@/core/context'
import type { IssueProvider } from '@/core/issue/base'
import { resolvePromptTemplate } from '@/core/prompts'
import { type AuditProvider, createAuditProvider } from '@/providers/index'
import type { Config } from '@/types'
import {
  type AuditFinding,
  AuditResponseSchema,
} from '@/types/schema/audit-schema'
import type { ExecResult } from '@/types/schema/exec-schema'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'

const logger = createLogger('audit')

const MAX_RULES_CHARS = 50_000

/**
 * Injectable dependencies for {@link auditCommand}.
 * Pass mocks in tests to control the audit provider and subprocess calls.
 */
export type AuditDeps = {
  execFn?: typeof execFileNoThrow
  provider?: AuditProvider
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
    for (const file of readdirSync('.claude/rules').filter((f) =>
      f.endsWith('.md'),
    )) {
      const content = readFileSync(join('.claude/rules', file), 'utf-8')
      parts.push(`## ${file}\n\n${content}`)
    }
  }

  if (parts.length === 0) {
    return '(no project rules found)'
  }

  let rulesContext = parts.join('\n\n---\n\n')
  if (rulesContext.length > MAX_RULES_CHARS) {
    logger.warn(
      { chars: rulesContext.length },
      'rules context truncated to avoid context overflow',
    )
    rulesContext = `${rulesContext.slice(0, MAX_RULES_CHARS)}\n[... truncated ...]`
  }
  return rulesContext
}

/**
 * Formats a subprocess result as a human-readable audit context string.
 *
 * @param result - Result from `execFileNoThrow`, or `null` if the check was skipped.
 * @returns A string describing pass/fail status and captured output.
 */
function formatCheckResult(result: ExecResult | null): string {
  if (result === null) {
    return '(skipped — not configured)'
  }
  const status = result.status === 0 ? 'PASS' : `FAIL (exit ${result.status})`
  const output = (result.stdout + result.stderr).trim()
  return output ? `${status}\n${output}` : status
}

/**
 * Formats audit findings as a markdown body for the findings issue.
 *
 * Groups findings by category and formats each with severity and detail.
 *
 * @param findings - Array of validated audit findings.
 * @returns Markdown-formatted string suitable for an issue body.
 */
function formatFindings(findings: AuditFinding[]): string {
  const grouped = new Map<string, AuditFinding[]>()
  for (const f of findings) {
    const list = grouped.get(f.category) ?? []
    list.push(f)
    grouped.set(f.category, list)
  }

  const categoryLabels: Record<string, string> = {
    failing_check: 'Failing Checks',
    unmet_criteria: 'Unmet Criteria',
    rule_violation: 'Rule Violations',
    production_readiness: 'Production Readiness',
  }

  const sections: string[] = []
  for (const [category, items] of grouped) {
    const label = categoryLabels[category] ?? category
    const lines = items.map(
      (f) => `- **[${f.severity.toUpperCase()}]** ${f.title}\n  ${f.detail}`,
    )
    sections.push(`### ${label}\n\n${lines.join('\n\n')}`)
  }

  return sections.join('\n\n')
}

/**
 * Audits a single COMPLETED issue by running deterministic checks and an AI review.
 *
 * Phase 1: runs tests, lint, and format check via `execFileNoThrow`.
 * Phase 2: sends prompt to the configured audit provider and parses structured JSON response.
 *
 * If findings are returned, creates a new issue via `provider.createIssue()`.
 * If everything passes, logs a success message.
 *
 * @param issueId - ID of the completed issue to audit.
 * @param config - Loaded barf configuration.
 * @param provider - Issue provider for reading/creating issues.
 */
async function auditIssue(
  issueId: string,
  config: Config,
  provider: IssueProvider,
  deps: AuditDeps,
): Promise<void> {
  const issueResult = await provider.fetchIssue(issueId)
  if (issueResult.isErr()) {
    logger.error(
      { issueId, err: issueResult.error.message },
      'could not fetch issue',
    )
    process.exitCode = 1
    return
  }

  const issue = issueResult.value
  if (issue.state !== 'COMPLETED') {
    logger.warn(
      { issueId, state: issue.state },
      'skipping — issue is not COMPLETED',
    )
    return
  }

  const execFn = deps.execFn ?? execFileNoThrow
  const auditProvider = deps.provider ?? createAuditProvider(config)
  if (!auditProvider.isConfigured(config)) {
    const info = auditProvider.describe()
    logger.error(
      { provider: auditProvider.name, requiredKeys: info.requiredConfigKeys },
      `${info.displayName} is not configured — check .barfrc`,
    )
    process.exitCode = 1
    return
  }

  logger.info({ issueId }, 'auditing issue')

  // ── Phase 1: deterministic checks ─────────────────────────────────────────

  const [testResult, lintResult, fmtResult] = await Promise.all([
    config.testCommand
      ? execFn('sh', ['-c', config.testCommand])
      : Promise.resolve(null),
    execFn('bun', ['run', 'lint']),
    execFn('bun', ['run', 'format:check']),
  ])

  // ── Phase 2: AI audit ──────────────────────────────────────────────────────

  const issueFile = join(config.issuesDir, `${issueId}.md`)
  const planFilePath = join(config.planDir, `${issueId}.md`)
  const planFile = existsSync(planFilePath)
    ? readFileSync(planFilePath, 'utf-8')
    : '(no plan file found)'

  const rulesContext = loadRulesContext()

  const prompt = injectTemplateVars(resolvePromptTemplate('audit', config), {
    BARF_ISSUE_ID: issueId,
    BARF_ISSUE_FILE: issueFile,
    PLAN_FILE: planFile,
    TEST_RESULTS: formatCheckResult(testResult),
    LINT_RESULTS: formatCheckResult(lintResult),
    FORMAT_RESULTS: formatCheckResult(fmtResult),
    RULES_CONTEXT: rulesContext,
  })

  const auditResult = await auditProvider.chatJSON(
    prompt,
    AuditResponseSchema,
    {
      jsonMode: true,
    },
  )

  if (auditResult.isErr()) {
    logger.error(
      { issueId, err: auditResult.error.message },
      'audit call failed',
    )
    process.exitCode = 1
    return
  }

  const auditResponse = auditResult.value
  logger.debug(
    { issueId, provider: auditProvider.name },
    'audit response received',
  )

  if (auditResponse.pass) {
    process.stdout.write(`\u2713 Issue #${issueId} passes audit\n`)
    logger.info({ issueId }, 'audit passed')
    return
  }

  // Create a findings issue via the provider
  const findingsBody = formatFindings(auditResponse.findings)
  const createResult = await provider.createIssue({
    title: `Audit findings: ${issue.title}`,
    body: findingsBody,
    parent: issueId,
  })

  if (createResult.isErr()) {
    logger.error(
      { issueId, err: createResult.error.message },
      'failed to create findings issue',
    )
    process.exitCode = 1
    return
  }

  const findingsIssue = createResult.value
  logger.warn(
    { issueId, findingsIssueId: findingsIssue.id },
    'audit found issues',
  )
  process.stdout.write(
    `\u2717 Issue #${issueId}: findings written to #${findingsIssue.id}\n`,
  )
  process.exitCode = 1
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
  config: Config,
  deps: AuditDeps = {},
): Promise<void> {
  if (opts.issue) {
    await auditIssue(opts.issue, config, provider, deps)
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
    await auditIssue(issue.id, config, provider, deps)
  }
}
