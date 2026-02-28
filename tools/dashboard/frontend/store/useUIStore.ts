/**
 * Zustand store for UI state (modals, sidebar tab, profiling).
 *
 * Replaces `newIssueOpen`, `configOpen`, `interviewTarget` signals.
 */
import { create } from 'zustand'
import type { Issue } from '@/types/schema/issue-schema'

type SidebarTab = 'issue' | 'prompts'

interface UIState {
  newIssueOpen: boolean
  configOpen: boolean
  interviewTarget: { issue: Issue; done: () => void } | null
  sidebarTab: SidebarTab
  profiling: boolean

  openNewIssue(): void
  closeNewIssue(): void
  openConfig(): void
  closeConfig(): void
  startInterview(issue: Issue, done: () => void): void
  endInterview(): void
  setSidebarTab(tab: SidebarTab): void
  toggleProfiling(): void
}

export const useUIStore = create<UIState>((set) => ({
  newIssueOpen: false,
  configOpen: false,
  interviewTarget: null,
  sidebarTab: 'issue',
  profiling: false,

  openNewIssue() {
    set({ newIssueOpen: true })
  },
  closeNewIssue() {
    set({ newIssueOpen: false })
  },
  openConfig() {
    set({ configOpen: true })
  },
  closeConfig() {
    set({ configOpen: false })
  },
  startInterview(issue, done) {
    set({ interviewTarget: { issue, done } })
  },
  endInterview() {
    set({ interviewTarget: null })
  },
  setSidebarTab(tab) {
    set({ sidebarTab: tab })
  },
  toggleProfiling() {
    set((s) => ({ profiling: !s.profiling }))
  },
}))
