/**
 * Tool call card for the activity log.
 *
 * Renders `kind: 'tool_call'` entries with a type badge ([TOOL] / [AGENT] /
 * [SKILL]), a collapsible args inspector, and the resolved tool result once
 * the matching `tool_result` entry arrives and is attached by the store.
 *
 * The `agentNames` map (toolUseId → subagent_type) is maintained by the
 * parent panel so nested Task subagent calls can be labelled accurately.
 */
import type React from 'react'
import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import type { ProcessedEntry } from '@dashboard/frontend/store/useActivityStore'
import { TOKENS } from '@dashboard/frontend/tokens'

interface ToolCardProps {
  /** The tool_call activity entry to render. */
  entry: ProcessedEntry
  /**
   * Map from toolUseId to subagent_type for labelling nested Task calls.
   * Provided by the parent log panel.
   */
  agentNames: ReadonlyMap<string, string>
}

/** Tool names that spawn subagents. */
const AGENT_TOOLS = new Set(['Task'])
/** Tool names that invoke skills. */
const SKILL_TOOLS = new Set(['Skill'])

interface BadgeConfig {
  label: string
  color: string
  bg: string
}

/** Returns badge config based on tool name. */
function getBadge(tool: string): BadgeConfig {
  if (AGENT_TOOLS.has(tool)) {
    return { label: 'AGENT', color: TOKENS.toolAgent, bg: TOKENS.toolAgentBg }
  }
  if (SKILL_TOOLS.has(tool)) {
    return { label: 'SKILL', color: TOKENS.toolSkill, bg: TOKENS.toolSkillBg }
  }
  return { label: 'TOOL', color: TOKENS.toolGeneric, bg: TOKENS.toolGenericBg }
}

/** Formats an HH:MM:SS string from a unix ms timestamp. */
function toHMS(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

/** Produces a compact one-liner snippet of the args object. */
function argsSnippet(args: unknown): string {
  if (args === null || args === undefined) return ''
  const str = typeof args === 'string' ? args : JSON.stringify(args)
  return str.length > 120 ? `${str.slice(0, 120)}…` : str
}

/**
 * Renders a collapsible tool call card for `kind: 'tool_call'` entries.
 *
 * Badge type is derived from the tool name. Expansion shows full args JSON and
 * the resolved result (or "awaiting result…" if `toolResult` is not yet set).
 *
 * @param entry - A {@link ProcessedEntry} with `kind === 'tool_call'`
 * @param agentNames - Map of toolUseId → subagent_type for agent labelling
 * @returns A collapsible tool card element
 */
export function ToolCard({
  entry,
  agentNames,
}: ToolCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const tool = typeof entry.data.tool === 'string' ? entry.data.tool : 'unknown'
  const args = entry.data.args
  const toolUseId =
    typeof entry.data.toolUseId === 'string' ? entry.data.toolUseId : ''
  const badge = getBadge(tool)

  // Extra label for Task/Skill tools
  let extraLabel = ''
  if (AGENT_TOOLS.has(tool)) {
    const subagentType =
      agentNames.get(toolUseId) ??
      (typeof (args as Record<string, unknown> | undefined)?.subagent_type ===
      'string'
        ? String((args as Record<string, unknown>).subagent_type)
        : undefined)
    if (subagentType !== undefined) {
      extraLabel = subagentType
    }
  } else if (SKILL_TOOLS.has(tool)) {
    const skillName =
      typeof (args as Record<string, unknown> | undefined)?.skill === 'string'
        ? String((args as Record<string, unknown>).skill)
        : ''
    if (skillName.length > 0) {
      extraLabel = skillName
    }
  }

  const snippet = argsSnippet(args)

  return (
    <Box
      sx={{
        borderLeft: `2px solid ${badge.color}`,
        bgcolor: badge.bg,
        px: 1,
        py: 0.5,
        fontFamily: 'monospace',
        fontSize: '0.78rem',
      }}
    >
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography
          component="span"
          sx={{
            color: badge.color,
            fontWeight: 'bold',
            fontSize: '0.68rem',
            border: `1px solid ${badge.color}`,
            px: 0.5,
            borderRadius: 0.5,
            flexShrink: 0,
          }}
        >
          {badge.label}
        </Typography>

        <Typography
          component="span"
          sx={{ color: badge.color, fontWeight: 600, fontSize: 'inherit' }}
        >
          {tool}
        </Typography>

        {extraLabel.length > 0 && (
          <Typography
            component="span"
            sx={{ color: 'text.secondary', fontSize: 'inherit' }}
          >
            · {extraLabel}
          </Typography>
        )}

        <Typography
          component="span"
          sx={{
            color: 'text.disabled',
            fontSize: '0.68rem',
            ml: 'auto',
            flexShrink: 0,
          }}
        >
          {toHMS(entry.timestamp)}
        </Typography>

        <IconButton
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{ p: 0.25, color: 'text.secondary' }}
          aria-label={
            expanded ? 'Collapse tool details' : 'Expand tool details'
          }
        >
          {expanded ? (
            <ExpandLessIcon fontSize="inherit" />
          ) : (
            <ExpandMoreIcon fontSize="inherit" />
          )}
        </IconButton>
      </Box>

      {/* Args snippet */}
      {snippet.length > 0 && !expanded && (
        <Typography
          sx={{
            color: 'text.disabled',
            fontSize: '0.7rem',
            mt: 0.25,
            pl: 0.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {snippet}
        </Typography>
      )}

      {/* Expanded details */}
      <Collapse in={expanded}>
        <Box sx={{ mt: 0.75 }}>
          <Typography
            sx={{ color: 'text.disabled', fontSize: '0.68rem', mb: 0.25 }}
          >
            Args
          </Typography>
          <Box
            component="pre"
            sx={{
              p: 0.75,
              bgcolor: TOKENS.surfaceOverlayDark,
              borderRadius: 0.5,
              color: TOKENS.codeText,
              fontSize: '0.72rem',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              m: 0,
              mb: 1,
            }}
          >
            {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
          </Box>

          <Typography
            sx={{ color: 'text.disabled', fontSize: '0.68rem', mb: 0.25 }}
          >
            Result
          </Typography>
          {entry.toolResult !== undefined ? (
            <Box
              component="pre"
              sx={{
                p: 0.75,
                bgcolor: entry.toolResult.isError
                  ? TOKENS.severityErrorBg
                  : TOKENS.severitySuccessBg,
                borderRadius: 0.5,
                color: entry.toolResult.isError
                  ? TOKENS.severityError
                  : TOKENS.severitySuccessText,
                fontSize: '0.72rem',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                m: 0,
              }}
            >
              {entry.toolResult.content}
            </Box>
          ) : (
            <Typography
              sx={{
                color: 'text.disabled',
                fontSize: '0.72rem',
                fontStyle: 'italic',
              }}
            >
              awaiting result…
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}
