/**
 * fetch() wrappers for /api/* endpoints.
 */
import type { Issue } from '@dashboard/frontend/lib/types'

/**
 * Fetches all issues from `GET /api/issues`.
 *
 * @returns Array of all issues in the barf issue store.
 */
export async function fetchIssues(): Promise<Issue[]> {
  const r = await fetch('/api/issues')
  if (!r.ok) throw new Error(`fetchIssues: ${r.status}`)
  return r.json()
}

/**
 * Creates a new issue via `POST /api/issues`.
 *
 * @param title - Required issue title.
 * @param body - Optional markdown body for the issue.
 * @returns The newly created issue.
 */
export async function createIssue(
  title: string,
  body?: string,
): Promise<Issue> {
  const r = await fetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body: body || undefined }),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Create failed')
  }
  return r.json()
}

/**
 * Updates title and/or body of an issue via `PUT /api/issues/:id`.
 *
 * @param id - The issue ID to update.
 * @param fields - Partial fields to overwrite (title, body).
 * @returns The updated issue.
 */
export async function updateIssue(
  id: string,
  fields: { title?: string; body?: string },
): Promise<Issue> {
  const r = await fetch(`/api/issues/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Update failed')
  }
  return r.json()
}

/**
 * Deletes an issue via `DELETE /api/issues/:id`.
 *
 * @param id - The issue ID to delete.
 */
export async function deleteIssue(id: string): Promise<void> {
  const r = await fetch(`/api/issues/${id}`, { method: 'DELETE' })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Delete failed')
  }
}

/**
 * Transitions an issue to a new state via `PUT /api/issues/:id/transition`.
 * The server validates the transition against the state machine.
 *
 * @param id - The issue ID to transition.
 * @param to - Target state string (e.g. `'PLANNED'`, `'BUILT'`).
 * @returns The updated issue with the new state applied.
 */
export async function transitionIssue(id: string, to: string): Promise<Issue> {
  const r = await fetch(`/api/issues/${id}/transition`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to }),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Transition failed')
  }
  return r.json()
}

/**
 * Fetches the plan file for an issue via `GET /api/issues/:id/plan`.
 * Returns `null` if no plan exists (404).
 *
 * @param id - The issue ID.
 * @returns The plan markdown content, or `null`.
 */
export async function fetchPlan(id: string): Promise<string | null> {
  const r = await fetch(`/api/issues/${id}/plan`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`fetchPlan: ${r.status}`)
  const data: { content: string } = await r.json()
  return data.content
}

/**
 * Saves the plan file for an issue via `PUT /api/issues/:id/plan`.
 *
 * @param id - The issue ID.
 * @param content - The plan markdown content.
 */
export async function savePlan(id: string, content: string): Promise<void> {
  const r = await fetch(`/api/issues/${id}/plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) {
    const e: { error?: string } = await r.json()
    throw new Error(e.error ?? 'Save plan failed')
  }
}

/**
 * Fetches the current `.barfrc` config via `GET /api/config`.
 *
 * @returns The config as a flat string record.
 */
export async function fetchConfig(): Promise<Record<string, string>> {
  const r = await fetch('/api/config')
  if (!r.ok) throw new Error(`fetchConfig: ${r.status}`)
  return r.json()
}

/**
 * Saves updated config values via `PUT /api/config`.
 *
 * @param config - Key-value pairs to write back to `.barfrc`.
 */
export async function saveConfig(
  config: Record<string, unknown>,
): Promise<void> {
  const r = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Save failed')
  }
}

// ── Prompt Templates ────────────────────────────────────────────────────────

/** Shape returned by `GET /api/prompts/:mode`. */
export interface PromptData {
  mode: string
  builtin: string
  custom: string | null
  active: string
}

/**
 * Fetches the list of all prompt mode names via `GET /api/prompts`.
 *
 * @returns Array of prompt mode strings (e.g. `['plan', 'build', ...]`).
 */
export async function fetchPromptModes(): Promise<string[]> {
  const r = await fetch('/api/prompts')
  if (!r.ok) throw new Error(`fetchPromptModes: ${r.status}`)
  return r.json()
}

/**
 * Fetches builtin + custom content for a prompt mode via `GET /api/prompts/:mode`.
 *
 * @param mode - The prompt mode to fetch.
 * @returns Prompt data with builtin, custom, and active content.
 */
export async function fetchPrompt(mode: string): Promise<PromptData> {
  const r = await fetch(`/api/prompts/${mode}`)
  if (!r.ok) throw new Error(`fetchPrompt: ${r.status}`)
  return r.json()
}

/**
 * Saves a custom prompt override via `PUT /api/prompts/:mode`.
 *
 * @param mode - The prompt mode to save.
 * @param content - The custom prompt template content.
 */
export async function savePrompt(mode: string, content: string): Promise<void> {
  const r = await fetch(`/api/prompts/${mode}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) {
    const e: { error?: string } = await r.json()
    throw new Error(e.error ?? 'Save prompt failed')
  }
}

/**
 * Deletes a custom prompt override via `DELETE /api/prompts/:mode`,
 * reverting to the built-in default.
 *
 * @param mode - The prompt mode to revert.
 */
export async function deletePrompt(mode: string): Promise<void> {
  const r = await fetch(`/api/prompts/${mode}`, { method: 'DELETE' })
  if (!r.ok) {
    const e: { error?: string } = await r.json()
    throw new Error(e.error ?? 'Delete prompt failed')
  }
}

/**
 * Sends a stop signal to any active barf run via `POST /api/auto/stop`.
 */
export async function stopActive(): Promise<void> {
  await fetch('/api/auto/stop', { method: 'POST' })
}

/**
 * Response shape returned by the interview endpoint after each submission.
 * When `status` is `'more_questions'`, `questions` contains the next round.
 * When `status` is `'complete'`, `issue` contains the updated issue.
 */
export interface InterviewResponse {
  status: 'complete' | 'more_questions'
  issue?: Issue
  questions?: Array<{ question: string; options?: string[] }>
}

/**
 * Submits interview answers for an issue via `POST /api/issues/:issueId/interview`.
 * Used by the interview modal to iteratively gather requirements until the
 * AI signals the interview is complete.
 *
 * @param issueId - The issue being interviewed.
 * @param answers - Pairs of question and user-provided answer.
 * @returns The server response indicating whether more questions follow or the interview is done.
 */
export async function submitInterview(
  issueId: string,
  answers: Array<{ question: string; answer: string }>,
): Promise<InterviewResponse> {
  const r = await fetch(`/api/issues/${issueId}/interview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Interview failed')
  }
  return r.json()
}
