/**
 * Zustand store for config and audit gate state.
 *
 * Replaces `models`, `auditGate` signals and config-related actions.
 */
import { create } from 'zustand'
import * as api from '@dashboard/frontend/common/utils/api-client'

interface AuditGateState {
  state: 'running' | 'draining' | 'auditing' | 'fixing'
  triggeredBy?: string
  triggeredAt?: string
  completedSinceLastAudit: number
  auditFixIssueIds: string[]
}

interface ConfigState {
  models: Record<string, string> | null
  auditGate: AuditGateState

  fetchConfig(): Promise<void>
  saveConfig(config: Record<string, unknown>): Promise<void>
  fetchAuditGate(): Promise<void>
  triggerAuditGate(): Promise<void>
  cancelAuditGate(): Promise<void>
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  models: null,
  auditGate: {
    state: 'running',
    completedSinceLastAudit: 0,
    auditFixIssueIds: [],
  },

  async fetchConfig() {
    try {
      const config = await api.fetchConfig()
      set({ models: config })
    } catch {
      // non-critical
    }
  },

  async saveConfig(config) {
    await api.saveConfig(config)
    await get().fetchConfig()
  },

  async fetchAuditGate() {
    try {
      const data = await api.fetchAuditGate()
      set({
        auditGate: {
          state: (data.state as AuditGateState['state']) ?? 'running',
          triggeredBy: data.triggeredBy as string | undefined,
          triggeredAt: data.triggeredAt as string | undefined,
          completedSinceLastAudit:
            (data.completedSinceLastAudit as number) ?? 0,
          auditFixIssueIds: (data.auditFixIssueIds as string[]) ?? [],
        },
      })
    } catch {
      // silently ignore
    }
  },

  async triggerAuditGate() {
    await api.triggerAuditGate()
    await get().fetchAuditGate()
  },

  async cancelAuditGate() {
    await api.cancelAuditGate()
    await get().fetchAuditGate()
  },
}))
