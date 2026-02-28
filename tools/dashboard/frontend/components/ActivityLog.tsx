/**
 * Reactive activity log panel — data-driven Preact component replacing the
 * imperative DOM-appending `panels/activity-log.ts`.
 *
 * Renders from the {@link activityEntries} signal array. Consecutive stdout
 * entries are grouped into collapsible `<details>` blocks; tool calls display
 * as expandable cards with resolved results; stderr lines are parsed as pino
 * JSON when possible.
 */

import { SessionList } from '@dashboard/frontend/components/SessionList'
import { TodoList } from '@dashboard/frontend/components/TodoList'
import { wsClient } from '@dashboard/frontend/lib/actions'
import {
  activityEntries,
  activityOpen,
  activityTitle,
  termInputVisible,
} from '@dashboard/frontend/lib/state'
import type { ProcessedEntry } from '@dashboard/frontend/lib/types'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const PINO_LEVEL_NAMES: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
}

const PINO_INTERNAL_KEYS = new Set([
  'level',
  'time',
  'pid',
  'hostname',
  'name',
  'msg',
  'issueId',
])

interface PinoLog {
  levelName: string
  name: string
  msg: string
  issueId: string | undefined
  extra: Record<string, unknown>
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function parsePinoLog(line: string): PinoLog | null {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>
    if (typeof obj.level !== 'number' || typeof obj.msg !== 'string')
      return null
    const extra: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (!PINO_INTERNAL_KEYS.has(k)) extra[k] = v
    }
    return {
      levelName: PINO_LEVEL_NAMES[obj.level] ?? String(obj.level),
      name: typeof obj.name === 'string' ? obj.name : '',
      msg: obj.msg,
      issueId: typeof obj.issueId === 'string' ? obj.issueId : undefined,
      extra,
    }
  } catch {
    return null
  }
}

function resolveToolMeta(
  toolName: string,
  isAgent: boolean,
): {
  borderCls: string
  badgeText: string
} {
  if (toolName === 'Task')
    return { borderCls: 'border-l-[#2dd4bf]', badgeText: 'AGENT' }
  if (toolName === 'Skill')
    return { borderCls: 'border-l-accent', badgeText: 'SKILL' }
  if (isAgent) return { borderCls: 'border-l-[#2dd4bf]', badgeText: 'AGENT' }
  return { borderCls: 'border-l-info', badgeText: 'TOOL' }
}

function mainArgSnippet(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const truncate = (s: string, len = 60): string =>
    s.length > len ? `${s.slice(0, len)}\u2026` : s

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const p = String(args.file_path ?? '')
      if (!p) return ''
      const parts = p.split('/').filter(Boolean)
      return parts.slice(-2).join('/')
    }
    case 'Bash':
      return truncate(String(args.command ?? ''))
    case 'Glob':
      return String(args.pattern ?? '')
    case 'Grep':
      return String(args.pattern ?? '')
    case 'Task': {
      const desc = String(args.description ?? '')
      return truncate(desc || String(args.subagent_type ?? ''))
    }
    case 'Skill':
      return String(args.skill ?? '')
    default: {
      const first = Object.values(args)[0]
      return first !== undefined ? truncate(String(first)) : ''
    }
  }
}

// ---------------------------------------------------------------------------
// Level color helpers
// ---------------------------------------------------------------------------

const LEVEL_COLOR: Record<string, string> = {
  WARN: 'text-warning-light',
  ERROR: 'text-danger-light',
  FATAL: 'text-danger-light',
}

const MSG_COLOR: Record<string, string> = {
  WARN: 'text-warning-light',
  ERROR: 'text-danger-light',
  FATAL: 'text-danger-light',
}

// ---------------------------------------------------------------------------
// Grouped entries type
// ---------------------------------------------------------------------------

type GroupedItem =
  | { type: 'group'; entries: ProcessedEntry[] }
  | { type: 'single'; entry: ProcessedEntry }

// ---------------------------------------------------------------------------
// Filter definitions
// ---------------------------------------------------------------------------

const FILTER_DEFS = [
  { kind: 'all', label: 'All' },
  { kind: 'tool_call', label: 'Tools' },
  { kind: 'token_update', label: 'Tokens' },
  { kind: 'stdout', label: 'Output' },
  { kind: 'error', label: 'Errors' },
] as const

const ALL_KINDS = new Set<string>([
  'stdout',
  'stderr',
  'tool_call',
  'tool_result',
  'token_update',
  'result',
  'error',
])

// ---------------------------------------------------------------------------
// Issue badge helper
// ---------------------------------------------------------------------------

function IssueBadge({
  issueId,
  issueName,
}: {
  issueId?: string
  issueName?: string
}) {
  if (!issueId) return null
  return (
    <span className="text-info shrink-0">
      #{issueId}
      {issueName ? `:${issueName}` : ''}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Shared summary row styles
// ---------------------------------------------------------------------------

const summaryBase =
  'flex gap-sm items-baseline px-md py-[0.125rem] cursor-pointer list-none select-none opacity-80 hover:opacity-100 [&::marker]:hidden [&::-webkit-details-marker]:hidden'

const argsJsonCls =
  'text-xs leading-[1.4] m-0 px-md pl-3xl text-text-slate whitespace-pre overflow-x-auto'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StdoutGroup({ entries }: { entries: ProcessedEntry[] }) {
  const first = entries[0]
  if (!first) return null
  const count = entries.length
  const issueTag = first.issueId
    ? ` \u00b7 #${first.issueId}${first.issueName ? `:${first.issueName}` : ''}`
    : ''
  const summaryText = `\u25E6 Claude output${issueTag} \u00b7 ${count} line${count === 1 ? '' : 's'} \u00b7 ${fmtTime(first.timestamp)}`

  return (
    <details
      className="border-l-2 border-l-[rgba(226,232,240,0.2)] my-xs pl-md"
      data-kind="stdout"
      open
    >
      <summary className="text-xs text-text-muted cursor-pointer py-[0.125rem] list-none select-none hover:text-text [&::marker]:hidden [&::-webkit-details-marker]:hidden">
        {summaryText}
      </summary>
      {entries.map((e) => {
        const line = String(e.data.line ?? '')

        if (line.startsWith('__BARF_STATE__:')) {
          const state = line.slice('__BARF_STATE__:'.length).trim()
          return (
            <div
              key={e.key}
              className="bg-[#b45309] text-[#fef3c7] font-bold text-sm px-lg py-[0.1875rem] rounded-[0.1875rem] my-xs"
            >
              {'\u2192'} {state}
            </div>
          )
        }

        const trimmed = line.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed)
            return (
              <pre
                key={e.key}
                className="text-xs leading-[1.4] my-[0.125rem] px-md py-xs bg-[rgba(255,255,255,0.04)] rounded-[0.1875rem] overflow-x-auto text-[#a3e635] whitespace-pre"
              >
                {JSON.stringify(parsed, null, 2)}
              </pre>
            )
          } catch {
            /* not valid JSON, fall through */
          }
        }

        return (
          <div key={e.key} className="flex gap-md text-sm leading-[1.5]">
            <span className="text-text-muted text-xs min-w-[3.75rem] shrink-0 font-mono">
              {fmtTime(e.timestamp)}
            </span>
            <span className="text-text flex-1 break-words">{line}</span>
          </div>
        )
      })}
    </details>
  )
}

function StderrRow({ entry }: { entry: ProcessedEntry }) {
  const rawLine = String(entry.data.line ?? '')
  const pino = parsePinoLog(rawLine)

  if (pino) {
    const lvlColor = LEVEL_COLOR[pino.levelName] ?? 'text-text-muted'
    const msgColor = MSG_COLOR[pino.levelName] ?? 'text-text-light'
    const extraEntries = Object.entries(pino.extra).filter(
      ([k]) => k !== 'title',
    )

    return (
      <details
        className="m-0 border-l-[3px] border-l-success-light"
        data-kind="stderr"
      >
        <summary className={`${summaryBase} flex-wrap`}>
          <span className="text-text-muted text-[0.8rem] min-w-[3.75rem] shrink-0">
            {fmtTime(entry.timestamp)}
          </span>
          <span className={`font-mono shrink-0 basis-[5%] ${lvlColor}`}>
            [{pino.levelName}]
          </span>
          {pino.issueId && (
            <span className="text-info shrink-0">
              #{pino.issueId}
              {typeof pino.extra.title === 'string'
                ? `:${pino.extra.title}`
                : ''}
            </span>
          )}
          {pino.name && (
            <span className="px-xs rounded-[0.125rem] bg-[color-mix(in_srgb,var(--color-text-slate)_12%,transparent)] text-text-slate shrink-0 font-semibold">
              {pino.name}
            </span>
          )}
          <span className={msgColor}>{pino.msg}</span>
          {extraEntries.length > 0 && (
            <span className="text-text-muted shrink-0 font-mono">
              {extraEntries.map(([k, v]) => `${k}:${v}`).join('  ')}
            </span>
          )}
        </summary>
        <pre className={argsJsonCls}>{JSON.stringify(pino, null, 2)}</pre>
      </details>
    )
  }

  return (
    <details
      className="m-0 border-l-[3px] border-l-success-light"
      data-kind="stderr"
    >
      <summary className={summaryBase}>
        <span className="text-text-muted text-[0.8rem] min-w-[3.75rem] shrink-0">
          {fmtTime(entry.timestamp)}
        </span>
        <span className="font-mono shrink-0 basis-[5%] text-danger-light">
          [STDERR]
        </span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="text-text-light">{rawLine}</span>
      </summary>
    </details>
  )
}

function ToolCard({
  entry,
  agentNames,
}: {
  entry: ProcessedEntry
  agentNames: Map<string, string>
}) {
  const toolName = String(entry.data.tool ?? 'unknown')
  const args = entry.data.args as Record<string, unknown> | undefined
  const isAgent = entry.data.parentToolUseId != null
  const { borderCls, badgeText } = resolveToolMeta(toolName, isAgent)
  const agentLabel = isAgent
    ? (agentNames.get(String(entry.data.parentToolUseId)) ?? null)
    : null

  let displayName = toolName
  if (toolName === 'Task' && args?.subagent_type)
    displayName = String(args.subagent_type)
  else if (toolName === 'Skill' && args?.skill) displayName = String(args.skill)

  const snippet = args ? mainArgSnippet(toolName, args) : ''

  return (
    <details
      className={`m-0 border-l-[3px] ${borderCls}`}
      data-kind="tool_call"
    >
      <summary className={summaryBase}>
        <span className="text-text-muted text-[0.8rem] min-w-[3.75rem] shrink-0">
          {fmtTime(entry.timestamp)}
        </span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="font-mono shrink-0 basis-[5%] text-text-muted">
          [{badgeText}]
        </span>
        {agentLabel && (
          <span className="text-[#2dd4bf]/70 text-[0.7rem]">{agentLabel}</span>
        )}
        <span className="px-xs rounded-[0.125rem] bg-[color-mix(in_srgb,var(--color-text-slate)_12%,transparent)] text-text-slate shrink-0 font-semibold">
          {displayName}
        </span>
        {snippet && <span className="text-text-light">{snippet}</span>}
      </summary>
      {args && (
        <pre className={argsJsonCls}>{JSON.stringify(args, null, 2)}</pre>
      )}
      {entry.toolResult ? (
        <div
          className={`px-md pl-3xl py-xs text-xs italic ${entry.toolResult.isError ? 'text-danger-light not-italic' : 'text-text-muted'}`}
        >
          <pre
            className="m-0 whitespace-pre-wrap break-words text-text-light not-italic"
            title={
              entry.toolResult.content.length > 500
                ? entry.toolResult.content
                : undefined
            }
          >
            {entry.toolResult.content.length > 500
              ? `${entry.toolResult.content.slice(0, 500)}\u2026`
              : entry.toolResult.content}
          </pre>
        </div>
      ) : (
        <div className="px-md pl-3xl py-xs text-xs text-text-muted italic">
          awaiting result{'\u2026'}
        </div>
      )}
    </details>
  )
}

function TokenRow({ entry }: { entry: ProcessedEntry }) {
  const inp = entry.data.input_tokens ?? 0
  const out = entry.data.output_tokens ?? 0
  const cacheCreate = entry.data.cache_creation_input_tokens ?? 0
  const cacheRead = entry.data.cache_read_input_tokens ?? 0

  return (
    <details
      className="m-0 border-l-[3px] border-l-[#e202d7]"
      data-kind="token_update"
    >
      <summary className={`${summaryBase} opacity-55`}>
        <span className="text-text-muted text-[0.8rem] min-w-[3.75rem] shrink-0">
          {fmtTime(entry.timestamp)}
        </span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="font-mono shrink-0 basis-[5%] text-success opacity-70">
          [TOKENS]
        </span>
        <span className="text-text-light">
          +{String(inp)} in, +{String(out)} out
        </span>
      </summary>
      <pre className={argsJsonCls}>
        {JSON.stringify(
          {
            input_tokens: inp,
            output_tokens: out,
            cache_creation_input_tokens: cacheCreate,
            cache_read_input_tokens: cacheRead,
          },
          null,
          2,
        )}
      </pre>
    </details>
  )
}

function ResultRow({ entry }: { entry: ProcessedEntry }) {
  return (
    <details
      className="m-0 border-l-[3px] border-l-transparent"
      data-kind="result"
    >
      <summary className={`${summaryBase} opacity-55`}>
        <span className="text-text-muted text-[0.8rem] min-w-[3.75rem] shrink-0">
          {fmtTime(entry.timestamp)}
        </span>
        <span className="font-mono shrink-0 basis-[5%] text-success-light">
          [RESULT]
        </span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="text-text-light">
          {String(entry.data.result ?? '')}
        </span>
      </summary>
      <pre className={argsJsonCls}>{JSON.stringify(entry.data, null, 2)}</pre>
    </details>
  )
}

function ErrorBanner({ entry }: { entry: ProcessedEntry }) {
  const errorText = String(entry.data.error ?? 'error')
  const truncated =
    errorText.length > 80 ? `${errorText.slice(0, 80)}\u2026` : errorText

  return (
    <details className="m-0 border-l-[3px] border-l-danger" data-kind="error">
      <summary className={summaryBase}>
        <span className="text-text-muted text-[0.8rem] min-w-[3.75rem] shrink-0">
          {fmtTime(entry.timestamp)}
        </span>
        <span className="font-mono shrink-0 basis-[5%] text-danger-light">
          [ERROR]
        </span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="text-text-light">{truncated}</span>
      </summary>
      <pre className={argsJsonCls}>{JSON.stringify(entry.data, null, 2)}</pre>
    </details>
  )
}

function TermLine({ entry }: { entry: ProcessedEntry }) {
  const typeStyles: Record<string, string> = {
    info: 'text-info italic',
    done: 'text-success-light font-bold',
    error: 'text-danger-light font-bold',
  }
  return (
    <div className={typeStyles[entry.termType ?? 'info'] ?? 'text-info italic'}>
      {entry.termText ?? ''}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function FilterBar({
  active,
  onToggle,
}: {
  active: Set<string>
  onToggle: (kind: string) => void
}) {
  return (
    <>
      {FILTER_DEFS.map((f) => {
        const isActive =
          f.kind === 'all' ? active.size === ALL_KINDS.size : active.has(f.kind)
        return (
          <button
            type="button"
            key={f.kind}
            className={`btn btn-xs ${
              isActive ? 'btn-primary btn-outline' : 'btn-ghost border-neutral'
            }`}
            data-kind={f.kind}
            onClick={() => onToggle(f.kind)}
          >
            {f.label}
          </button>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Reactive activity log panel. Reads {@link activityEntries} and renders a
 * filterable, auto-scrolling timeline of stdout groups, tool cards, stderr
 * rows, token updates, results, and errors.
 */
export function ActivityLog() {
  const entries = activityEntries.value
  const isOpen = activityOpen.value
  const title = activityTitle.value
  const showInput = termInputVisible.value

  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(ALL_KINDS),
  )

  // Map Task toolUseId → subagent_type for labelling subagent tool calls
  const agentNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) {
      if (e.kind === 'tool_call' && e.data.tool === 'Task') {
        const id = e.data.toolUseId as string | undefined
        const args = e.data.args as Record<string, unknown> | undefined
        const name = String(args?.subagent_type ?? args?.description ?? 'agent')
        if (id) map.set(id, name)
      }
    }
    return map
  }, [])

  // Cumulative tokens
  const cumulativeTokens = useMemo(() => {
    let input = 0
    let output = 0
    for (const e of entries) {
      if (e.kind === 'token_update') {
        input += Number(e.data.input_tokens ?? 0)
        output += Number(e.data.output_tokens ?? 0)
      }
    }
    return { input, output }
  }, [])

  // Group consecutive stdout entries
  const grouped = useMemo<GroupedItem[]>(() => {
    const result: GroupedItem[] = []
    let stdoutBuf: ProcessedEntry[] = []

    const flushStdout = () => {
      if (stdoutBuf.length > 0) {
        result.push({ type: 'group', entries: stdoutBuf })
        stdoutBuf = []
      }
    }

    for (const e of entries) {
      // Synthetic termLog entries are never grouped
      if (e.termType !== undefined) {
        flushStdout()
        result.push({ type: 'single', entry: e })
        continue
      }

      // State banners break the group but are still stdout
      if (e.kind === 'stdout') {
        const line = String(e.data.line ?? '')
        if (line.startsWith('__BARF_STATE__:')) {
          flushStdout()
          result.push({ type: 'single', entry: e })
        } else {
          stdoutBuf.push(e)
        }
        continue
      }

      // tool_result entries are not rendered standalone; they resolve into tool cards
      if (e.kind === 'tool_result') continue

      flushStdout()
      result.push({ type: 'single', entry: e })
    }
    flushStdout()
    return result
  }, [])

  // Scroll to bottom when entries change
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // Focus input when it becomes visible
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
  }, [])

  const handleFilterToggle = (kind: string) => {
    setActiveFilters((prev) => {
      if (kind === 'all') return new Set(ALL_KINDS)
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const input = e.target as HTMLInputElement
      const value = input.value.trim()
      if (value) {
        wsClient.send(value)
        input.value = ''
      }
    }
  }

  const headerTitle =
    cumulativeTokens.input > 0 || cumulativeTokens.output > 0
      ? `${title} \u00b7 in: ${cumulativeTokens.input.toLocaleString()} out: ${cumulativeTokens.output.toLocaleString()}`
      : title

  const isVisible = (kind: string): boolean => activeFilters.has(kind)

  const renderItem = (item: GroupedItem, idx: number) => {
    if (item.type === 'group') {
      if (!isVisible('stdout')) return null
      return <StdoutGroup key={`g-${idx}`} entries={item.entries} />
    }

    const e = item.entry

    // Synthetic termLog
    if (e.termType !== undefined) {
      return <TermLine key={e.key} entry={e} />
    }

    // State banner (stdout that broke the group)
    if (e.kind === 'stdout') {
      if (!isVisible('stdout')) return null
      const line = String(e.data.line ?? '')
      const state = line.slice('__BARF_STATE__:'.length).trim()
      return (
        <div
          key={e.key}
          className="bg-[#b45309] text-[#fef3c7] font-bold text-sm px-lg py-[0.1875rem] rounded-[0.1875rem] my-xs"
          data-kind="stdout"
        >
          {'\u2192'} {state}
        </div>
      )
    }

    if (!isVisible(e.kind)) return null

    switch (e.kind) {
      case 'stderr':
        return <StderrRow key={e.key} entry={e} />
      case 'tool_call':
        return <ToolCard key={e.key} entry={e} agentNames={agentNames} />
      case 'token_update':
        return <TokenRow key={e.key} entry={e} />
      case 'result':
        return <ResultRow key={e.key} entry={e} />
      case 'error':
        return <ErrorBanner key={e.key} entry={e} />
      default:
        return null
    }
  }

  return (
    <div
      id="bottom"
      className="border-t border-neutral flex flex-col bg-base-100"
      style={{
        gridArea: 'bottom',
        maxHeight: isOpen ? '18.75rem' : undefined,
      }}
    >
      {/* Header — always visible, clickable to toggle */}
      <button
        type="button"
        className="flex items-center justify-between px-lg py-xs border-b border-neutral shrink-0 cursor-pointer select-none hover:bg-base-200 transition-colors w-full bg-transparent text-inherit"
        onClick={() => {
          activityOpen.value = !activityOpen.value
        }}
      >
        <div className="flex items-center gap-md">
          <span className="text-xs text-text-muted">
            {isOpen ? '\u25BC' : '\u25B6'}
          </span>
          <span className="text-sm text-text-muted">
            {headerTitle || 'Activity'}
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="flex gap-sm items-center justify-end px-lg py-xs border-b border-neutral shrink-0">
          <FilterBar active={activeFilters} onToggle={handleFilterToggle} />
        </div>
      )}

      {/* Log content — only when open */}
      {isOpen && (
        <div className="flex flex-1 min-h-0">
          {/* Session list (left panel) — always visible */}
          <div className="w-[12.5rem] shrink-0 border-r border-neutral overflow-y-auto">
            <SessionList />
          </div>

          {/* Activity detail (right panel) */}
          <div className="flex-1 flex flex-col min-w-0">
            <TodoList />
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto px-xl py-md text-sm leading-[1.6]"
            >
              {grouped.map(renderItem)}
            </div>

            {/* Terminal input row */}
            <div
              className={`items-center gap-md px-lg py-[0.3125rem] border-t border-neutral shrink-0 ${showInput ? 'flex' : 'hidden'}`}
            >
              <span className="text-sm text-info whitespace-nowrap">
                answer &gt;
              </span>
              <input
                ref={inputRef}
                className="flex-1 bg-transparent border-none text-text font-inherit text-sm outline-none placeholder:text-text-muted"
                type="text"
                autoComplete="off"
                spellcheck={false}
                placeholder="type your answer and press Enter"
                onKeyDown={handleInputKeyDown}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
