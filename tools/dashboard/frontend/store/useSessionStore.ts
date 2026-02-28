/**
 * Zustand store for session management.
 *
 * Replaces `sessions`, `selectedSessionId`, `showArchived` signals
 * and session-related actions from `actions.ts`.
 */
import { create } from 'zustand'
import * as api from '@dashboard/frontend/common/utils/api-client'
import type { Session } from '@/types/schema/session-index-schema'

interface SessionState {
  sessions: Session[]
  selectedSessionId: string | null
  showArchived: boolean

  fetchSessions(): Promise<void>
  selectSession(sessionId: string): void
  deselectSession(): void
  stopSession(pid: number): Promise<void>
  stopAll(): Promise<void>
  deleteSession(sessionId: string): Promise<void>
  archiveSession(sessionId: string): Promise<void>
  setShowArchived(v: boolean): void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  selectedSessionId: null,
  showArchived: false,

  async fetchSessions() {
    try {
      const sessions = await api.fetchSessions()
      set({ sessions })
    } catch {
      // best-effort
    }
  },

  selectSession(sessionId) {
    const { selectedSessionId } = get()
    if (selectedSessionId === sessionId) {
      // Toggle off
      set({ selectedSessionId: null })
      return
    }
    set({ selectedSessionId: sessionId })
  },

  deselectSession() {
    set({ selectedSessionId: null })
  },

  async stopSession(pid) {
    try {
      await api.stopSessionByPid(pid)
      await get().fetchSessions()
    } catch {
      // silently ignore
    }
  },

  async stopAll() {
    const running = get().sessions.filter((s) => s.status === 'running')
    await Promise.all(running.map((s) => api.stopSessionByPid(s.pid)))
    await get().fetchSessions()
  },

  async deleteSession(sessionId) {
    try {
      await api.deleteSession(sessionId)
      if (get().selectedSessionId === sessionId) {
        set({ selectedSessionId: null })
      }
      await get().fetchSessions()
    } catch {
      // silently ignore
    }
  },

  async archiveSession(sessionId) {
    try {
      await api.archiveSession(sessionId)
      if (get().selectedSessionId === sessionId) {
        set({ selectedSessionId: null })
      }
      await get().fetchSessions()
    } catch {
      // silently ignore
    }
  },

  setShowArchived(v) {
    set({ showArchived: v })
  },
}))
