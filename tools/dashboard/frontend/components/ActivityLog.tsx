/**
 * Reactive activity log panel — data-driven Preact component replacing the
 * imperative DOM-appending `panels/activity-log.ts`.
 *
 * Renders from the {@link activityEntries} signal array. Consecutive stdout
 * entries are grouped into collapsible `<details>` blocks; tool calls display
 * as expandable cards with resolved results; stderr lines are parsed as pino
 * JSON when possible.
 */

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

function resolveToolMeta(toolName: string): { cls: string; badgeText: string } {
  if (toolName === 'Task') return { cls: 'agent-card', badgeText: 'AGENT' }
  if (toolName === 'Skill') return { cls: 'skill-card', badgeText: 'SKILL' }
  return { cls: 'tool-card', badgeText: 'TOOL' }
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
    <span className="pino-issue-id">
      #{issueId}
      {issueName ? `:${issueName}` : ''}
    </span>
  )
}

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
    <details className="turn-group" data-kind="stdout" open>
      <summary className="turn-group-summary">{summaryText}</summary>
      {entries.map((e) => {
        const line = String(e.data.line ?? '')

        if (line.startsWith('__BARF_STATE__:')) {
          const state = line.slice('__BARF_STATE__:'.length).trim()
          return (
            <div key={e.key} className="state-banner">
              \u2192 {state}
            </div>
          )
        }

        const trimmed = line.trim()
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed)
            return (
              <pre key={e.key} className="json-block">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            )
          } catch {
            /* not valid JSON, fall through */
          }
        }

        return (
          <div key={e.key} className="stdout-line">
            <span className="gutter-time">{fmtTime(e.timestamp)}</span>
            <span className="line-text">{line}</span>
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
    const lvlCls = `pino-level-${pino.levelName.toLowerCase()}`
    let levelCls = ''
    if (pino.levelName === 'WARN') levelCls = 'pino-warn'
    else if (pino.levelName === 'ERROR' || pino.levelName === 'FATAL')
      levelCls = 'pino-error'

    const cssClass = `activity-row pino-row${levelCls ? ` ${levelCls}` : ''}`
    const extraEntries = Object.entries(pino.extra).filter(
      ([k]) => k !== 'title',
    )

    return (
      <details className={cssClass} data-kind="stderr">
        <summary className="activity-summary">
          <span className="log-time">{fmtTime(entry.timestamp)}</span>
          <span className={`pino-level ${lvlCls}`}>[{pino.levelName}]</span>
          {pino.issueId && (
            <span className="pino-issue-id">
              #{pino.issueId}
              {typeof pino.extra.title === 'string'
                ? `:${pino.extra.title}`
                : ''}
            </span>
          )}
          {pino.name && <span className="pino-name">{pino.name}</span>}
          <span className="pino-msg">{pino.msg}</span>
          {extraEntries.length > 0 && (
            <span className="pino-extra">
              {extraEntries.map(([k, v]) => `${k}:${v}`).join('  ')}
            </span>
          )}
        </summary>
        <pre className="args-json">{JSON.stringify(pino, null, 2)}</pre>
      </details>
    )
  }

  return (
    <details className="activity-row pino-row" data-kind="stderr">
      <summary className="activity-summary">
        <span className="log-time">{fmtTime(entry.timestamp)}</span>
        <span className="pino-level pino-level-error">[STDERR]</span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="pino-msg">{rawLine}</span>
      </summary>
    </details>
  )
}

function ToolCard({ entry }: { entry: ProcessedEntry }) {
  const toolName = String(entry.data.tool ?? 'unknown')
  const args = entry.data.args as Record<string, unknown> | undefined
  const { cls, badgeText } = resolveToolMeta(toolName)

  let displayName = toolName
  if (toolName === 'Task' && args?.subagent_type)
    displayName = String(args.subagent_type)
  else if (toolName === 'Skill' && args?.skill) displayName = String(args.skill)

  const snippet = args ? mainArgSnippet(toolName, args) : ''

  return (
    <details className={`activity-row ${cls}`} data-kind="tool_call">
      <summary className="activity-summary">
        <span className="log-time">{fmtTime(entry.timestamp)}</span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="pino-level">[{badgeText}]</span>
        <span className="pino-name">{displayName}</span>
        {snippet && <span className="pino-msg">{snippet}</span>}
      </summary>
      {args && <pre className="args-json">{JSON.stringify(args, null, 2)}</pre>}
      {entry.toolResult ? (
        <div
          className={`result-slot${entry.toolResult.isError ? ' result-error' : ''}`}
        >
          <pre
            className="result-content"
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
        <div className="result-slot">awaiting result\u2026</div>
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
    <details className="activity-row token-row" data-kind="token_update">
      <summary className="activity-summary">
        <span className="log-time">{fmtTime(entry.timestamp)}</span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="pino-level pino-level-tokens">[TOKENS]</span>
        <span className="pino-msg">
          +{String(inp)} in, +{String(out)} out
        </span>
      </summary>
      <pre className="args-json">
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
    <details className="activity-row result-row" data-kind="result">
      <summary className="activity-summary">
        <span className="log-time">{fmtTime(entry.timestamp)}</span>
        <span className="pino-level pino-level-result">[RESULT]</span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="pino-msg">{String(entry.data.result ?? '')}</span>
      </summary>
      <pre className="args-json">{JSON.stringify(entry.data, null, 2)}</pre>
    </details>
  )
}

function ErrorBanner({ entry }: { entry: ProcessedEntry }) {
  const errorText = String(entry.data.error ?? 'error')
  const truncated =
    errorText.length > 80 ? `${errorText.slice(0, 80)}\u2026` : errorText

  return (
    <details className="activity-row error-row" data-kind="error">
      <summary className="activity-summary">
        <span className="log-time">{fmtTime(entry.timestamp)}</span>
        <span className="pino-level pino-level-error">[ERROR]</span>
        <IssueBadge issueId={entry.issueId} issueName={entry.issueName} />
        <span className="pino-msg">{truncated}</span>
      </summary>
      <pre className="args-json">{JSON.stringify(entry.data, null, 2)}</pre>
    </details>
  )
}

function TermLine({ entry }: { entry: ProcessedEntry }) {
  return (
    <div className={`t-${entry.termType ?? 'info'}`}>
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
            className={`filter-btn${isActive ? ' active' : ''}`}
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
  }, [entries])

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
  }, [entries])

  // Scroll to bottom when entries change
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  // Focus input when it becomes visible
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
  }, [showInput])

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
        <div key={e.key} className="state-banner" data-kind="stdout">
          {'\u2192'} {state}
        </div>
      )
    }

    if (!isVisible(e.kind)) return null

    switch (e.kind) {
      case 'stderr':
        return <StderrRow key={e.key} entry={e} />
      case 'tool_call':
        return <ToolCard key={e.key} entry={e} />
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
    <div id="bottom" className={isOpen ? 'open' : ''}>
      <div id="activity-header">
        <span id="activity-title">{headerTitle}</span>
        <div id="activity-controls">
          <FilterBar active={activeFilters} onToggle={handleFilterToggle} />
          <button
            type="button"
            id="activity-close"
            onClick={() => {
              activityOpen.value = false
            }}
          >
            {'\u2715'}
          </button>
        </div>
      </div>

      <div id="activity-log" ref={logRef}>
        {grouped.map(renderItem)}
      </div>

      <div id="term-input-row" className={showInput ? 'visible' : ''}>
        <span id="term-input-prompt">answer &gt;</span>
        <input
          ref={inputRef}
          id="term-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="type your answer and press Enter"
          onKeyDown={handleInputKeyDown}
        />
      </div>
    </div>
  )
}
