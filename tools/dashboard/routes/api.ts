/**
 * REST API routes — CRUD issues, transitions, config, interview.
 */

import type { IssueService } from '@dashboard/services/issue-service'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import {
  cancelAuditGate,
  readAuditGate,
  triggerAuditGate,
  writeAuditGateEvent,
} from '@/core/batch'
import { injectTemplateVars } from '@/core/context'
import { VALID_TRANSITIONS } from '@/core/issue'
import { BUILTIN_TEMPLATES, resolvePromptTemplate } from '@/core/prompts'
import type { PromptMode } from '@/core/prompts'
import { IssueStateSchema } from '@/types'
import { PromptModeSchema } from '@/types/schema/mode-schema'
import { unlinkSync } from 'fs'
import { execFileNoThrow } from '@/utils/execFileNoThrow'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

function jsonError(message: string, status = 400): Response {
  return json({ error: message }, status)
}

export { json, jsonError }

export async function handleListIssues(svc: IssueService): Promise<Response> {
  const result = await svc.provider.listIssues()
  if (result.isErr()) return jsonError(result.error.message, 500)
  return json(result.value)
}

export async function handleGetIssue(
  svc: IssueService,
  id: string,
): Promise<Response> {
  const result = await svc.provider.fetchIssue(id)
  if (result.isErr()) return jsonError(result.error.message, 404)
  return json(result.value)
}

export async function handleCreateIssue(
  svc: IssueService,
  req: Request,
): Promise<Response> {
  let body: { title?: string; body?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  if (!body.title?.trim()) return jsonError('title is required')
  const result = await svc.provider.createIssue({
    title: body.title.trim(),
    body: body.body,
  })
  if (result.isErr()) return jsonError(result.error.message, 500)
  return json(result.value, 201)
}

export async function handleUpdateIssue(
  svc: IssueService,
  id: string,
  req: Request,
): Promise<Response> {
  let body: { title?: string; body?: string; state?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  const fields: Record<string, unknown> = {}
  if (body.title !== undefined) fields.title = body.title
  if (body.body !== undefined) fields.body = body.body
  const result = await svc.provider.writeIssue(id, fields)
  if (result.isErr()) return jsonError(result.error.message, 500)
  return json(result.value)
}

export async function handleDeleteIssue(
  svc: IssueService,
  id: string,
): Promise<Response> {
  const result = await svc.provider.deleteIssue(id)
  if (result.isErr()) return jsonError(result.error.message, 500)
  return json({ ok: true })
}

export async function handleTransition(
  svc: IssueService,
  id: string,
  req: Request,
): Promise<Response> {
  let body: { to?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  const parsed = IssueStateSchema.safeParse(body.to)
  if (!parsed.success) return jsonError(`Invalid state: ${body.to}`)
  const result = await svc.provider.transition(id, parsed.data)
  if (result.isErr()) return jsonError(result.error.message, 400)
  return json(result.value)
}

export function handleGetConfig(svc: IssueService): Response {
  const c = svc.config
  return json({
    projectCwd: svc.projectCwd,
    configPath: svc.configPath,
    ...c,
    // Mask API keys — send a placeholder if set, empty if not
    openaiApiKey: c.openaiApiKey ? '••••••••' : '',
    geminiApiKey: c.geminiApiKey ? '••••••••' : '',
    anthropicApiKey: c.anthropicApiKey ? '••••••••' : '',
  })
}

export function getValidTransitions(): Record<string, string[]> {
  return VALID_TRANSITIONS
}

/** Reverse map: camelCase config key → SCREAMING_SNAKE .barfrc key */
const REVERSE_KEY_MAP: Record<string, string> = {
  issuesDir: 'ISSUES_DIR',
  planDir: 'PLAN_DIR',
  contextUsagePercent: 'CONTEXT_USAGE_PERCENT',
  maxAutoSplits: 'MAX_AUTO_SPLITS',
  maxIterations: 'MAX_ITERATIONS',
  maxVerifyRetries: 'MAX_VERIFY_RETRIES',
  claudeTimeout: 'CLAUDE_TIMEOUT',
  testCommand: 'TEST_COMMAND',
  fixCommands: 'FIX_COMMANDS',
  auditModel: 'AUDIT_MODEL',
  triageModel: 'TRIAGE_MODEL',
  planModel: 'PLAN_MODEL',
  buildModel: 'BUILD_MODEL',
  splitModel: 'SPLIT_MODEL',
  openaiApiKey: 'OPENAI_API_KEY',
  auditProvider: 'AUDIT_PROVIDER',
  geminiApiKey: 'GEMINI_API_KEY',
  geminiModel: 'GEMINI_MODEL',
  anthropicApiKey: 'ANTHROPIC_API_KEY',
  claudeAuditModel: 'CLAUDE_AUDIT_MODEL',
  extendedContextModel: 'EXTENDED_CONTEXT_MODEL',
  pushStrategy: 'PUSH_STRATEGY',
  issueProvider: 'ISSUE_PROVIDER',
  githubRepo: 'GITHUB_REPO',
  disableLogStream: 'DISABLE_LOG_STREAM',
  barfDir: 'BARF_DIR',
  promptDir: 'PROMPT_DIR',
  logFile: 'LOG_FILE',
  logLevel: 'LOG_LEVEL',
  logPretty: 'LOG_PRETTY',
  auditAfterNCompleted: 'AUDIT_AFTER_N_COMPLETED',
}

const MASKED = '••••••••'

export async function handleInterview(
  svc: IssueService,
  id: string,
  req: Request,
): Promise<Response> {
  let body: { answers: Array<{ question: string; answer: string }> }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return jsonError('answers array is required')
  }

  const issueResult = await svc.provider.fetchIssue(id)
  if (issueResult.isErr()) return jsonError(issueResult.error.message, 404)
  const issue = issueResult.value

  // Format Q&A for the prompt
  const qaText = body.answers
    .map((a, i) => `${i + 1}. **Q:** ${a.question}\n   **A:** ${a.answer}`)
    .join('\n\n')

  const prompt = injectTemplateVars(
    resolvePromptTemplate('interview_eval', svc.config),
    {
      BARF_ISSUE_ID: id,
      BARF_ISSUE_BODY: issue.body,
      BARF_INTERVIEW_QA: qaText,
    },
  )

  const execResult = await execFileNoThrow('claude', [
    '-p',
    prompt,
    '--model',
    svc.config.triageModel,
    '--output-format',
    'text',
  ])

  if (execResult.status !== 0) {
    return jsonError(
      `Claude interview eval failed (exit ${execResult.status}): ${execResult.stderr.trim()}`,
      500,
    )
  }

  // Parse response
  let evalResult: {
    satisfied: boolean
    questions?: Array<{ question: string; options?: string[] }>
  }
  try {
    let raw = execResult.stdout.trim()
    // Strip markdown fences if present
    const fenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/)
    if (fenceMatch) raw = fenceMatch[1].trim()
    // Fallback: extract first JSON object from response
    if (!raw.startsWith('{')) {
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start !== -1 && end > start) raw = raw.slice(start, end + 1)
    }
    evalResult = JSON.parse(raw)
  } catch {
    return jsonError(
      `Failed to parse Claude eval response: ${execResult.stdout.slice(0, 200)}`,
      500,
    )
  }

  // Strip any prior partial Q&A section from body before re-appending
  const bodyWithoutPartialQa = issue.body.replace(
    /\n\n## Interview Q&A \(In Progress\)\n\n[\s\S]*?(?=\n\n## |\s*$)/,
    '',
  )

  if (!evalResult.satisfied) {
    // Persist partial answers so progress survives if user leaves
    const partialQaSection = `\n\n## Interview Q&A (In Progress)\n\n${qaText}`
    await svc.provider.writeIssue(id, {
      body: bodyWithoutPartialQa + partialQaSection,
    })
    return json({
      status: 'more_questions',
      questions: evalResult.questions ?? [],
    })
  }

  // Satisfied — update issue: append Q&A, remove questions + partial sections, transition to GROOMED
  const qaSection = `\n\n## Interview Q&A\n\n${qaText}`
  const cleanBody = bodyWithoutPartialQa.replace(
    /\n\n## Interview Questions\n\n[\s\S]*$/,
    '',
  )
  const writeResult = await svc.provider.writeIssue(id, {
    needs_interview: false,
    state: 'GROOMED',
    body: cleanBody + qaSection,
  })
  if (writeResult.isErr()) return jsonError(writeResult.error.message, 500)

  return json({ status: 'complete', issue: writeResult.value })
}

/**
 * Returns the plan file content for an issue, or 404 if no plan exists.
 * Plan files live at `{planDir}/{issueId}.md`.
 */
export function handleGetPlan(svc: IssueService, id: string): Response {
  const planPath = resolve(svc.projectCwd, svc.config.planDir, `${id}.md`)
  if (!existsSync(planPath)) {
    return jsonError('No plan found', 404)
  }
  const content = readFileSync(planPath, 'utf-8')
  return json({ content })
}

/**
 * Saves plan file content for an issue via `PUT /api/issues/:id/plan`.
 * Creates the plan directory if it doesn't exist.
 */
export async function handleSavePlan(
  svc: IssueService,
  id: string,
  req: Request,
): Promise<Response> {
  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  if (typeof body.content !== 'string') return jsonError('content is required')
  const planDir = resolve(svc.projectCwd, svc.config.planDir)
  const planPath = join(planDir, `${id}.md`)
  try {
    mkdirSync(planDir, { recursive: true })
    writeFileSync(planPath, body.content)
    return json({ ok: true })
  } catch (e) {
    return jsonError(
      `Failed to save plan: ${e instanceof Error ? e.message : String(e)}`,
      500,
    )
  }
}

export async function handleSaveConfig(
  svc: IssueService,
  req: Request,
): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }

  const rcPath = svc.configPath ?? join(svc.projectCwd, '.barfrc')

  // Read existing file to preserve comments and unknown keys
  let existingLines: string[] = []
  try {
    existingLines = readFileSync(rcPath, 'utf8').split('\n')
  } catch {
    // File doesn't exist yet — start fresh
  }

  // Build set of keys we'll write
  const written = new Set<string>()
  const outputLines: string[] = []

  for (const line of existingLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      outputLines.push(line)
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      outputLines.push(line)
      continue
    }
    const envKey = trimmed.slice(0, eq).trim()
    // Find camelCase key for this env key
    const camelKey = Object.entries(REVERSE_KEY_MAP).find(
      ([, v]) => v === envKey,
    )?.[0]
    if (camelKey && camelKey in body) {
      const val = body[camelKey]
      // Skip masked API keys — keep existing value
      if (typeof val === 'string' && val === MASKED) {
        outputLines.push(line)
      } else {
        const serialized = Array.isArray(val) ? val.join(',') : String(val)
        outputLines.push(`${envKey}=${serialized}`)
      }
      written.add(camelKey)
    } else {
      outputLines.push(line)
    }
  }

  // Append new keys not in existing file
  for (const [camelKey, envKey] of Object.entries(REVERSE_KEY_MAP)) {
    if (written.has(camelKey) || !(camelKey in body)) continue
    const val = body[camelKey]
    if (typeof val === 'string' && val === MASKED) continue
    const serialized = Array.isArray(val) ? val.join(',') : String(val)
    outputLines.push(`${envKey}=${serialized}`)
  }

  try {
    writeFileSync(rcPath, outputLines.join('\n'))
    return json({ ok: true, path: rcPath })
  } catch (e) {
    return jsonError(
      `Failed to write config: ${e instanceof Error ? e.message : String(e)}`,
      500,
    )
  }
}

// ── Audit Gate ──────────────────────────────────────────────────────────────

/**
 * Returns the current audit gate state from `.barf/audit-gate.json`.
 */
export function handleGetAuditGate(svc: IssueService): Response {
  const gate = readAuditGate(svc.config.barfDir)
  return json(gate)
}

/**
 * Triggers the audit gate by transitioning to `draining` state.
 */
export function handleTriggerAuditGate(svc: IssueService): Response {
  const triggered = triggerAuditGate(svc.config.barfDir, 'dashboard')
  if (!triggered) {
    return jsonError('Audit gate is already active', 409)
  }
  writeAuditGateEvent(svc.config.barfDir, 'draining', {
    triggeredBy: 'dashboard',
  })
  return json({ ok: true, state: 'draining' })
}

/**
 * Cancels the audit gate, returning to `running` state.
 */
export function handleCancelAuditGate(svc: IssueService): Response {
  const cancelled = cancelAuditGate(svc.config.barfDir)
  if (!cancelled) {
    return jsonError('Audit gate is not active', 409)
  }
  writeAuditGateEvent(svc.config.barfDir, 'cancelled')
  return json({ ok: true, state: 'running' })
}

// ── Prompt Templates ────────────────────────────────────────────────────────

/** Returns the list of all prompt mode names. */
export function handleListPrompts(): Response {
  return json(PromptModeSchema.options)
}

/**
 * Returns builtin, custom, and active content for a given prompt mode.
 * Auto-creates `PROMPT_DIR` if not configured.
 */
export function handleGetPrompt(svc: IssueService, mode: string): Response {
  const parsed = PromptModeSchema.safeParse(mode)
  if (!parsed.success) return jsonError(`Invalid prompt mode: ${mode}`)
  const promptMode = parsed.data

  const builtin = BUILTIN_TEMPLATES[promptMode]
  const promptDir = resolvePromptDir(svc)
  const customPath = join(promptDir, `PROMPT_${promptMode}.md`)
  const custom = existsSync(customPath) ? readFileSync(customPath, 'utf-8') : null
  const active = custom ?? builtin

  return json({ mode: promptMode, builtin, custom, active })
}

/** Saves custom prompt content to `PROMPT_DIR/PROMPT_{mode}.md`. */
export async function handleSavePrompt(
  svc: IssueService,
  mode: string,
  req: Request,
): Promise<Response> {
  const parsed = PromptModeSchema.safeParse(mode)
  if (!parsed.success) return jsonError(`Invalid prompt mode: ${mode}`)

  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON body')
  }
  if (typeof body.content !== 'string') return jsonError('content is required')

  const promptDir = resolvePromptDir(svc)
  const promptPath = join(promptDir, `PROMPT_${parsed.data}.md`)
  try {
    mkdirSync(promptDir, { recursive: true })
    writeFileSync(promptPath, body.content)
    return json({ ok: true })
  } catch (e) {
    return jsonError(
      `Failed to save prompt: ${e instanceof Error ? e.message : String(e)}`,
      500,
    )
  }
}

/** Deletes a custom prompt override, reverting to the builtin template. */
export function handleDeletePrompt(svc: IssueService, mode: string): Response {
  const parsed = PromptModeSchema.safeParse(mode)
  if (!parsed.success) return jsonError(`Invalid prompt mode: ${mode}`)

  const promptDir = resolvePromptDir(svc)
  const promptPath = join(promptDir, `PROMPT_${parsed.data}.md`)
  try {
    if (existsSync(promptPath)) unlinkSync(promptPath)
    return json({ ok: true })
  } catch (e) {
    return jsonError(
      `Failed to delete prompt: ${e instanceof Error ? e.message : String(e)}`,
      500,
    )
  }
}

/**
 * Resolves the prompt directory, defaulting to `.barf/prompts/` and
 * auto-creating it if needed.
 */
function resolvePromptDir(svc: IssueService): string {
  if (svc.config.promptDir) return resolve(svc.projectCwd, svc.config.promptDir)
  return resolve(svc.projectCwd, '.barf', 'prompts')
}
