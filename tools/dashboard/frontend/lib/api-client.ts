/**
 * fetch() wrappers for /api/* endpoints.
 */
import type { Issue } from './types'

export async function fetchIssues(): Promise<Issue[]> {
  const r = await fetch('/api/issues')
  if (!r.ok) throw new Error(`fetchIssues: ${r.status}`)
  return r.json()
}

export async function fetchIssue(id: string): Promise<Issue> {
  const r = await fetch(`/api/issues/${id}`)
  if (!r.ok) throw new Error(`fetchIssue: ${r.status}`)
  return r.json()
}

export async function createIssue(title: string, body?: string): Promise<Issue> {
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

export async function updateIssue(id: string, fields: { title?: string; body?: string }): Promise<Issue> {
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

export async function saveConfig(config: Record<string, unknown>): Promise<void> {
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

export async function fetchLogHistory(issueId: string): Promise<unknown[]> {
  const r = await fetch(`/api/issues/${issueId}/logs/history`)
  if (!r.ok) return []
  return r.json()
}
