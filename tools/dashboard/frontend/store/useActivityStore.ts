/**
 * Zustand store for the activity log panel.
 *
 * Replaces `activityEntries`, `activityOpen`, `activityTitle`,
 * `termInputVisible`, `todoItems` signals and the pushActivity/logTerm
 * functions from `actions.ts`.
 */
import { create } from 'zustand'
import type { ActivityKind } from '@/types/schema/activity-schema'

/** A rendered activity entry for the reactive activity log. */
export interface ProcessedEntry {
  key: string
  kind: ActivityKind
  timestamp: number
  issueId?: string
  issueName?: string
  data: Record<string, unknown>
  toolResult?: { content: string; isError: boolean }
  termType?: string
  termText?: string
}

/** A task item extracted from Claude's TaskCreate/TaskUpdate tool calls. */
export interface TodoItem {
  id: string
  subject: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

type ActivityFilter = Set<ActivityKind>

const MAX_ENTRIES = 5000
const TASK_TOOLS = new Set(['TaskCreate', 'TaskUpdate', 'TodoWrite'])
const VALID_STATUSES = new Set<TodoItem['status']>([
  'pending',
  'in_progress',
  'completed',
])

interface ActivityState {
  entries: ProcessedEntry[]
  liveEntries: ProcessedEntry[]
  filters: ActivityFilter
  todoItems: TodoItem[]
  isOpen: boolean
  title: string
  termInputVisible: boolean
  isHistorical: boolean

  // Internal
  _entryCounter: number
  _toolCallIndex: Map<string, number>

  // Actions
  pushEntry(entry: {
    kind: ActivityKind
    timestamp: number
    issueId?: string
    issueName?: string
    data: Record<string, unknown>
    source?: string
  }): void
  logTerm(type: string, text: string): void
  clearLog(): void
  setFilter(filter: ActivityFilter): void
  openPanel(title?: string): void
  closePanel(): void
  setTermInputVisible(v: boolean): void
  setHistoricalEntries(entries: ProcessedEntry[]): void
  restoreLiveEntries(): void
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  entries: [],
  liveEntries: [],
  filters: new Set<ActivityKind>(),
  todoItems: [],
  isOpen: false,
  title: 'Activity Log',
  termInputVisible: false,
  isHistorical: false,
  _entryCounter: 0,
  _toolCallIndex: new Map(),

  pushEntry(entry) {
    const state = get()
    const key = `e-${state._entryCounter}`
    const counter = state._entryCounter + 1

    // Handle tool_result resolution
    if (entry.kind === 'tool_result') {
      const toolUseId = entry.data.toolUseId as string | undefined
      const idx = toolUseId ? state._toolCallIndex.get(toolUseId) : undefined
      if (idx !== undefined && state.liveEntries[idx]) {
        const updated = [...state.liveEntries]
        updated[idx] = {
          ...updated[idx],
          toolResult: {
            content: String(entry.data.content ?? ''),
            isError: entry.data.isError === true,
          },
        }
        set({
          liveEntries: updated,
          entries: state.isHistorical ? state.entries : updated,
          _entryCounter: counter,
        })
      }
      return
    }

    const processed: ProcessedEntry = {
      key,
      kind: entry.kind,
      timestamp: entry.timestamp,
      issueId: entry.issueId,
      issueName: entry.issueName,
      data: entry.data,
    }

    let live = [...state.liveEntries, processed]
    const newIndex = new Map(state._toolCallIndex)

    if (entry.kind === 'tool_call') {
      const toolUseId = entry.data.toolUseId as string | undefined
      if (toolUseId) newIndex.set(toolUseId, live.length - 1)
    }

    // Trim
    if (live.length > MAX_ENTRIES) {
      live = live.slice(-MAX_ENTRIES)
      newIndex.clear()
      for (let i = 0; i < live.length; i++) {
        if (live[i].kind === 'tool_call') {
          const id = live[i].data.toolUseId as string | undefined
          if (id) newIndex.set(id, i)
        }
      }
    }

    // Extract todos
    const todos = extractTodo(entry, state.todoItems)

    set({
      liveEntries: live,
      entries: state.isHistorical ? state.entries : live,
      _entryCounter: counter,
      _toolCallIndex: newIndex,
      ...(todos !== state.todoItems ? { todoItems: todos } : {}),
    })
  },

  logTerm(type, text) {
    const state = get()
    const key = `t-${state._entryCounter}`
    const entry: ProcessedEntry = {
      key,
      kind: 'stdout',
      timestamp: Date.now(),
      data: {},
      termType: type,
      termText: text,
    }
    const live = [...state.liveEntries, entry]
    set({
      liveEntries: live,
      entries: state.isHistorical ? state.entries : live,
      _entryCounter: state._entryCounter + 1,
    })
  },

  clearLog() {
    set({
      liveEntries: [],
      entries: [],
      todoItems: [],
      _entryCounter: 0,
      _toolCallIndex: new Map(),
      isHistorical: false,
    })
  },

  setFilter(filter) {
    set({ filters: filter })
  },

  openPanel(title) {
    set({ isOpen: true, ...(title ? { title } : {}) })
  },

  closePanel() {
    set({ isOpen: false })
  },

  setTermInputVisible(v) {
    set({ termInputVisible: v })
  },

  setHistoricalEntries(entries) {
    set({ entries, isHistorical: true })
  },

  restoreLiveEntries() {
    const { liveEntries } = get()
    set({ entries: liveEntries, isHistorical: false })
  },
}))

/** Extracts todo items from tool calls. */
function extractTodo(
  entry: { kind: string; data: Record<string, unknown> },
  current: TodoItem[],
): TodoItem[] {
  if (entry.kind !== 'tool_call') return current
  const tool = entry.data.tool as string
  if (!TASK_TOOLS.has(tool)) return current
  const args = entry.data.args as Record<string, unknown> | undefined
  if (!args) return current

  if (tool === 'TaskCreate') {
    const subject = String(args.subject ?? '')
    if (!subject) return current
    if (current.some((t) => t.subject === subject)) return current
    const id = (entry.data.toolUseId as string) ?? `tmp-${Date.now()}`
    return [
      ...current,
      {
        id,
        subject,
        status: 'pending',
        activeForm:
          typeof args.activeForm === 'string' ? args.activeForm : undefined,
      },
    ]
  }

  if (tool === 'TaskUpdate') {
    const taskId = String(args.taskId ?? '')
    const status = args.status as string | undefined
    if (!taskId || !status || !VALID_STATUSES.has(status as TodoItem['status']))
      return current
    return current.map((t) =>
      t.id === taskId ? { ...t, status: status as TodoItem['status'] } : t,
    )
  }

  if (tool === 'TodoWrite') {
    const tasks = args.tasks as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(tasks)) return current
    return tasks
      .filter((t) => typeof t.subject === 'string')
      .map((t, i) => ({
        id: String(t.id ?? i),
        subject: String(t.subject),
        status: VALID_STATUSES.has(t.status as TodoItem['status'])
          ? (t.status as TodoItem['status'])
          : 'pending',
        activeForm: typeof t.activeForm === 'string' ? t.activeForm : undefined,
      }))
  }

  return current
}
