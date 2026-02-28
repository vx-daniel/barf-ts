/**
 * Zustand store for issue state management.
 *
 * Replaces the `issues`, `selectedId`, `runningId`, `pauseRefresh` signals
 * and the issue-related actions from `actions.ts`.
 */
import { create } from 'zustand'
import * as api from '@dashboard/frontend/common/utils/api-client'
import type { Issue } from '@/types/schema/issue-schema'

interface SSEClient {
  close(): void
}

interface IssueState {
  issues: Issue[]
  selectedId: string | null
  runningId: string | null
  pauseRefresh: boolean
  activeCommand: string | null

  // Actions
  fetchIssues(): Promise<void>
  openCard(issue: Issue): void
  navigateToIssue(id: string): void
  doTransition(id: string, to: string): Promise<void>
  deleteIssue(id: string): Promise<void>
  setRunning(id: string | null): void
  setPauseRefresh(v: boolean): void
  setActiveCommand(cmd: string | null): void
  setSelectedId(id: string | null): void
  updateIssueInList(id: string, updates: Partial<Issue>): void
  stopAndReset(): void
  runCommand(id: string, cmd: string): void
  runAuto(): void
}

/** Module-level SSE/WS transport — shared across store actions. */
let sseClient: SSEClient | null = null
let logSSEClient: SSEClient | null = null

/** Register transport instances from the hooks layer. */
export function registerTransports(sse: SSEClient, logSSE: SSEClient): void {
  sseClient = sse
  logSSEClient = logSSE
}

export const useIssueStore = create<IssueState>((set, get) => ({
  issues: [],
  selectedId: null,
  runningId: null,
  pauseRefresh: false,
  activeCommand: null,

  async fetchIssues() {
    try {
      const issues = await api.fetchIssues()
      set({ issues })
    } catch {
      // logged via activity store
    }
  },

  openCard(issue) {
    set({ selectedId: issue.id })
  },

  navigateToIssue(id) {
    const issue = get().issues.find((i) => i.id === id)
    if (issue) set({ selectedId: issue.id })
  },

  async doTransition(id, to) {
    try {
      await api.transitionIssue(id, to)
      await get().fetchIssues()
    } catch {
      // errors handled by activity store
    }
  },

  async deleteIssue(id) {
    try {
      await api.deleteIssue(id)
      set({ selectedId: null })
      await get().fetchIssues()
    } catch {
      // errors handled by activity store
    }
  },

  setRunning(id) {
    set({ runningId: id })
  },

  setPauseRefresh(v) {
    set({ pauseRefresh: v })
  },

  setActiveCommand(cmd) {
    set({ activeCommand: cmd })
  },

  setSelectedId(id) {
    set({ selectedId: id })
  },

  updateIssueInList(id, updates) {
    set((s) => ({
      issues: s.issues.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }))
  },

  stopAndReset() {
    void api.stopActive()
    sseClient?.close()
    logSSEClient?.close()
    set({
      runningId: null,
      pauseRefresh: false,
      activeCommand: null,
    })
    void get().fetchIssues()
  },

  runCommand(id, cmd) {
    // interview is handled separately via UI store
    if (cmd === 'interview') return
    // Actual SSE connection is handled by useSSE hook in the component layer
    set({
      runningId: id,
      pauseRefresh: true,
      activeCommand: `${cmd} #${id}`,
    })
  },

  runAuto() {
    const { runningId } = get()
    if (runningId !== null) {
      // Stop
      void api.stopActive()
      sseClient?.close()
      set({
        runningId: null,
        pauseRefresh: false,
        activeCommand: null,
      })
      void get().fetchIssues()
      return
    }
    set({
      runningId: '__auto__',
      pauseRefresh: true,
      activeCommand: 'auto',
    })
  },
}))
