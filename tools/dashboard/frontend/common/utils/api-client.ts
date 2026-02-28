/**
 * fetch() wrappers for /api/* endpoints.
 */
import type { Issue } from '@/types/schema/issue-schema'
import type { Session } from '@/types/schema/session-index-schema'

export async function fetchIssues(): Promise<Issue[]> {
  const r = await fetch('/api/issues')
  if (!r.ok) throw new Error(`fetchIssues: ${r.status}`)
  return r.json()
}

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

export async function deleteIssue(id: string): Promise<void> {
  const r = await fetch(`/api/issues/${id}`, { method: 'DELETE' })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Delete failed')
  }
}

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

export async function fetchConfig(): Promise<Record<string, string>> {
  const r = await fetch('/api/config')
  if (!r.ok) throw new Error(`fetchConfig: ${r.status}`)
  return r.json()
}

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

export async function stopActive(): Promise<void> {
  await fetch('/api/auto/stop', { method: 'POST' })
}

export interface InterviewResponse {
  status: 'complete' | 'more_questions'
  issue?: Issue
  questions?: Array<{ question: string; options?: string[] }>
}

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

export async function fetchSessions(): Promise<Session[]> {
  const r = await fetch('/api/sessions')
  if (!r.ok) throw new Error(`fetchSessions: ${r.status}`)
  return r.json()
}

export async function stopSessionByPid(pid: number): Promise<void> {
  await fetch(`/api/sessions/${pid}/stop`, { method: 'POST' })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}

export async function archiveSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/archive`, {
    method: 'POST',
  })
}

export async function fetchAuditGate(): Promise<Record<string, unknown>> {
  const r = await fetch('/api/audit-gate')
  if (!r.ok) throw new Error(`fetchAuditGate: ${r.status}`)
  return r.json()
}

export async function triggerAuditGate(): Promise<void> {
  const r = await fetch('/api/audit-gate/trigger', { method: 'POST' })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Audit gate trigger failed')
  }
}

export async function cancelAuditGate(): Promise<void> {
  const r = await fetch('/api/audit-gate/cancel', { method: 'POST' })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Audit gate cancel failed')
  }
}

export async function fetchPrompts(): Promise<string[]> {
  const r = await fetch('/api/prompts')
  if (!r.ok) throw new Error(`fetchPrompts: ${r.status}`)
  return r.json()
}

export async function fetchPromptContent(name: string): Promise<string> {
  const r = await fetch(`/api/prompts/${encodeURIComponent(name)}`)
  if (!r.ok) throw new Error(`fetchPrompt: ${r.status}`)
  const data = await r.json()
  return data.content
}

export async function savePromptContent(
  name: string,
  content: string,
): Promise<void> {
  const r = await fetch(`/api/prompts/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!r.ok) {
    const e = await r.json()
    throw new Error(e.error ?? 'Save prompt failed')
  }
}
