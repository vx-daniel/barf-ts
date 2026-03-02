/**
 * StatsPanel — read-only stats tab for the IssuePanel.
 * Displays summary totals from frontmatter and a visual stage-by-stage
 * timeline parsed from the `## Stage Log` section of the issue body.
 */

import { contextBarColor, stateColor } from '@dashboard/frontend/lib/constants'
import type { Issue } from '@dashboard/frontend/lib/types'
import type { IssueState } from '@/types/schema/issue-schema'

// ── Stage log parser ─────────────────────────────────────────────────────────

interface ParsedStageEntry {
  toState: IssueState
  fromState: IssueState
  timestamp: string
  durationInStageSeconds: number
  inputTokens: number
  outputTokens: number
  finalContextSize: number
  iterations: number
  contextUsagePercent: number | undefined
  model: string
  trigger: string
}

const HEADING_RE = /^###\s+(\S+)\s+[—–-]\s+(.+)$/
const BULLET_RE = /^-\s+\*\*(.+?):\*\*\s*(.+)$/

/**
 * Parses the `## Stage Log` markdown section into structured entries.
 * Mirrors the format produced by {@link formatStageLogEntry}.
 *
 * @param body - Full issue body markdown
 * @returns Parsed stage log entries in chronological order
 */
function parseStageLog(body: string): ParsedStageEntry[] {
  const stageLogIdx = body.indexOf('## Stage Log')
  if (stageLogIdx === -1) return []

  const section = body.slice(stageLogIdx)
  // Stop at next ## heading that isn't Stage Log
  const nextH2 = section.indexOf('\n## ', 1)
  const content = nextH2 !== -1 ? section.slice(0, nextH2) : section

  const lines = content.split('\n')
  const entries: ParsedStageEntry[] = []
  let current: Partial<ParsedStageEntry> | null = null

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE)
    if (headingMatch) {
      if (current?.toState) entries.push(current as ParsedStageEntry)
      current = {
        toState: headingMatch[1] as IssueState,
        timestamp: headingMatch[2].trim(),
        durationInStageSeconds: 0,
        inputTokens: 0,
        outputTokens: 0,
        finalContextSize: 0,
        iterations: 0,
        contextUsagePercent: undefined,
        model: '',
        trigger: '',
      }
      continue
    }

    if (!current) continue

    const bulletMatch = line.match(BULLET_RE)
    if (!bulletMatch) continue

    const [, label, value] = bulletMatch
    switch (label) {
      case 'From':
        current.fromState = value.trim() as IssueState
        break
      case 'Duration in stage':
        current.durationInStageSeconds = parseInt(value, 10) || 0
        break
      case 'Input tokens': {
        // Format: "2,100 (final context: 1,800)"
        current.inputTokens = parseInt(value.replace(/,/g, ''), 10) || 0
        const ctxMatch = value.match(/final context:\s*([\d,]+)/)
        if (ctxMatch) {
          current.finalContextSize =
            parseInt(ctxMatch[1].replace(/,/g, ''), 10) || 0
        }
        break
      }
      case 'Output tokens':
        current.outputTokens = parseInt(value.replace(/,/g, ''), 10) || 0
        break
      case 'Iterations':
        current.iterations = parseInt(value, 10) || 0
        break
      case 'Context used':
        current.contextUsagePercent = parseInt(value, 10) || undefined
        break
      case 'Model':
        current.model = value.trim()
        break
      case 'Trigger':
        current.trigger = value.trim()
        break
    }
  }

  if (current?.toState) entries.push(current as ParsedStageEntry)
  return entries
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ts
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

// ── Bar component ────────────────────────────────────────────────────────────

function Bar({
  value,
  max,
  color,
  label,
}: {
  value: number
  max: number
  color: string
  label: string
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0
  return (
    <div className="flex items-center gap-sm text-xs">
      <span className="w-16 text-right text-base-content/50 shrink-0 text-[0.65rem]">
        {label}
      </span>
      <div className="flex-1 h-3 bg-base-300 rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function StatsPanel({ issue }: { issue: Issue }) {
  const entries = parseStageLog(issue.body ?? '')

  const maxDuration = Math.max(...entries.map((e) => e.durationInStageSeconds), 1)
  const maxTokens = Math.max(
    ...entries.map((e) => Math.max(e.inputTokens, e.outputTokens)),
    1,
  )

  return (
    <div className="flex-1 overflow-auto p-lg">
      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-sm mb-lg">
        <div className="stat bg-base-200 rounded-lg p-sm text-center">
          <div className="stat-title text-[0.6rem]">Runs</div>
          <div className="stat-value text-sm">{issue.run_count ?? 0}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-sm text-center">
          <div className="stat-title text-[0.6rem]">Duration</div>
          <div className="stat-value text-sm">
            {formatDuration(issue.total_duration_seconds ?? 0)}
          </div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-sm text-center">
          <div className="stat-title text-[0.6rem]">In Tokens</div>
          <div className="stat-value text-sm">
            {formatTokens(issue.total_input_tokens ?? 0)}
          </div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-sm text-center">
          <div className="stat-title text-[0.6rem]">Out Tokens</div>
          <div className="stat-value text-sm">
            {formatTokens(issue.total_output_tokens ?? 0)}
          </div>
        </div>
        <div className="stat bg-base-200 rounded-lg p-sm text-center">
          <div className="stat-title text-[0.6rem]">Iterations</div>
          <div className="stat-value text-sm">
            {issue.total_iterations ?? 0}
          </div>
        </div>
      </div>

      {/* Stage timeline */}
      {entries.length === 0 ? (
        <div className="text-center text-base-content/40 text-sm py-2xl">
          No stage log entries yet
        </div>
      ) : (
        <div className="flex flex-col">
          {entries.map((entry, i) => (
            <div key={i} className="flex gap-md mb-md">
              {/* Timeline connector */}
              <div className="flex flex-col items-center w-4 shrink-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: stateColor(entry.toState) }}
                />
                {i < entries.length - 1 && (
                  <div className="w-px flex-1 bg-base-content/20 mt-1" />
                )}
              </div>

              {/* Entry content */}
              <div className="flex-1 min-w-0 pb-md">
                {/* Header */}
                <div className="flex items-baseline gap-sm mb-sm">
                  <span
                    className="text-xs font-bold"
                    style={{ color: stateColor(entry.toState) }}
                  >
                    {entry.toState}
                  </span>
                  <span className="text-[0.65rem] text-base-content/40">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>

                {/* Bars */}
                <div className="flex flex-col gap-1 mb-1">
                  <Bar
                    value={entry.durationInStageSeconds}
                    max={maxDuration}
                    color="var(--color-info)"
                    label={formatDuration(entry.durationInStageSeconds)}
                  />
                  <Bar
                    value={entry.inputTokens}
                    max={maxTokens}
                    color="var(--color-primary)"
                    label={`${formatTokens(entry.inputTokens)} in`}
                  />
                  <Bar
                    value={entry.outputTokens}
                    max={maxTokens}
                    color="var(--color-secondary)"
                    label={`${formatTokens(entry.outputTokens)} out`}
                  />
                  {entry.contextUsagePercent !== undefined && (
                    <div className="flex items-center gap-sm text-xs">
                      <span className="w-16 text-right text-base-content/50 shrink-0 text-[0.65rem]">
                        ctx {entry.contextUsagePercent}%
                      </span>
                      <div className="flex-1 h-3 bg-base-300 rounded-sm overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all"
                          style={{
                            width: `${entry.contextUsagePercent}%`,
                            backgroundColor: contextBarColor(
                              entry.contextUsagePercent,
                            ),
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="text-[0.6rem] text-base-content/40">
                  {entry.model}
                  {entry.trigger && ` · ${entry.trigger}`}
                  {` · ${entry.iterations} iter${entry.iterations !== 1 ? 's' : ''}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
