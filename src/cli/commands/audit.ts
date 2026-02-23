import { join } from 'path'
import { existsSync, readFileSync, readdirSync } from 'fs'
import type { IssueProvider } from '@/core/issue/base'
import type { Config } from '@/types'
import type { ExecResult } from '@/types/schema/exec-schema'
import { runOpenAIChat } from '@/providers/openai'
import { AuditResponseSchema, type AuditFinding } from '@/types/schema/audit-schema'
import { injectTemplateVars } from '@/core/context'
import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'

// Embedded at compile time via Bun import attribute
import auditPromptTemplate from '@/prompts/PROMPT_audit.md' with { type: 'text' }

const logger = createLogger('audit')

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
    production_readiness: 'Production Readiness'
  }

  const sections: string[] = []
  for (const [category, items] of grouped) {
    const label = categoryLabels[category] ?? category
    const lines = items.map(f => `- **[${f.severity.toUpperCase()}]** ${f.title}\n  ${f.detail}`)
    sections.push(`### ${label}\n\n${lines.join('\n\n')}`)
  }

  return sections.join('\n\n')
}

/**
 * Audits a single COMPLETED issue by running deterministic checks and an AI review.
 *
 * Phase 1: runs tests, lint, and format check via `execFileNoThrow`.
 * Phase 2: sends prompt to OpenAI and parses structured JSON response.
 *
 * If findings are returned, creates a new issue via `provider.createIssue()`.
 * If everything passes, logs a success message.
 *
 * @param issueId - ID of the completed issue to audit.
 * @param config - Loaded barf configuration.
 * @param provider - Issue provider for reading/creating issues.
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

  if (!config.openaiApiKey) {
    logger.error({ issueId }, 'OPENAI_API_KEY not set in .barfrc — cannot run AI audit')
    process.exitCode = 1
    return
  }

  logger.info({ issueId }, 'auditing issue')

  // ── Phase 1: deterministic checks ─────────────────────────────────────────

  const [testResult, lintResult, fmtResult] = await Promise.all([
    config.testCommand ? execFileNoThrow('sh', ['-c', config.testCommand]) : Promise.resolve(null),
    execFileNoThrow('bun', ['run', 'lint']),
    execFileNoThrow('bun', ['run', 'format:check'])
  ])

  // ── Phase 2: AI audit via OpenAI ──────────────────────────────────────────

  const issueFile = join(config.issuesDir, `${issueId}.md`)
  const planFilePath = join(config.planDir, `${issueId}.md`)
  const planFile = existsSync(planFilePath)
    ? readFileSync(planFilePath, 'utf-8')
    : '(no plan file found)'

  const rulesContext = loadRulesContext()

  const prompt = injectTemplateVars(auditPromptTemplate, {
    BARF_ISSUE_ID: issueId,
    BARF_ISSUE_FILE: issueFile,
    PLAN_FILE: planFile,
    TEST_RESULTS: formatCheckResult(testResult),
    LINT_RESULTS: formatCheckResult(lintResult),
    FORMAT_RESULTS: formatCheckResult(fmtResult),
    RULES_CONTEXT: rulesContext
  })

  const chatResult = await runOpenAIChat(prompt, config.auditModel, config.openaiApiKey, {
    responseFormat: { type: 'json_object' }
  })

  if (chatResult.isErr()) {
    logger.error({ issueId, err: chatResult.error.message }, 'audit OpenAI call failed')
    process.exitCode = 1
    return
  }

  const { content, totalTokens } = chatResult.value
  logger.debug({ issueId, totalTokens }, 'OpenAI response received')

  // Parse the JSON response
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    logger.error({ issueId, content: content.slice(0, 200) }, 'audit response is not valid JSON')
    process.exitCode = 1
    return
  }

  const validation = AuditResponseSchema.safeParse(parsed)
  if (!validation.success) {
    logger.error(
      { issueId, errors: validation.error.issues },
      'audit response failed schema validation'
    )
    process.exitCode = 1
    return
  }

  const auditResponse = validation.data

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
    parent: issueId
  })

  if (createResult.isErr()) {
    logger.error({ issueId, err: createResult.error.message }, 'failed to create findings issue')
    process.exitCode = 1
    return
  }

  const findingsIssue = createResult.value
  logger.warn({ issueId, findingsIssueId: findingsIssue.id }, 'audit found issues')
  process.stdout.write(`\u2717 Issue #${issueId}: findings written to #${findingsIssue.id}\n`)
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
