/**
 * Activity log filter bar.
 *
 * Renders a row of {@link ToggleButton} controls for filtering visible
 * activity entry kinds. Selecting "All" clears all kind filters and shows
 * every entry type. Individual kind buttons toggle membership in the active
 * {@link ActivityFilter} set held by {@link useActivityStore}.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import type { ActivityKind } from '@/types/schema/activity-schema'
import { useActivityStore } from '@dashboard/frontend/store/useActivityStore'
import { TOKENS } from '@dashboard/frontend/tokens'

/** Displayable filter option (All is a pseudo-kind). */
type FilterOption = ActivityKind | 'all'

interface FilterSpec {
  value: FilterOption
  label: string
  /** The ActivityKind values activated by this button. Empty = all. */
  kinds: ActivityKind[]
}

const FILTER_SPECS: FilterSpec[] = [
  { value: 'all', label: 'All', kinds: [] },
  { value: 'tool_call', label: 'Tools', kinds: ['tool_call'] },
  { value: 'token_update', label: 'Tokens', kinds: ['token_update'] },
  { value: 'stdout', label: 'Output', kinds: ['stdout'] },
  { value: 'error', label: 'Errors', kinds: ['error', 'stderr'] },
]

/**
 * Returns the selected ToggleButtonGroup value(s) derived from the current filter set.
 * When the filter set is empty (all), returns `['all']`.
 */
function deriveSelected(filters: Set<ActivityKind>): FilterOption[] {
  if (filters.size === 0) return ['all']
  return FILTER_SPECS.filter(
    (spec) => spec.value !== 'all' && spec.kinds.every((k) => filters.has(k)),
  ).map((spec) => spec.value)
}

/**
 * Renders the filter toggle bar for the activity log panel.
 *
 * Selecting "All" resets the filter set. Individual buttons toggle their
 * associated {@link ActivityKind} values in/out of the active filter.
 *
 * @returns A row of MUI ToggleButtons for activity kind filtering
 */
export function FilterBar(): React.JSX.Element {
  const filters = useActivityStore((s) => s.filters)
  const setFilter = useActivityStore((s) => s.setFilter)

  const selected = deriveSelected(filters)

  function handleChange(
    _: React.MouseEvent<HTMLElement>,
    newValues: FilterOption[],
  ): void {
    if (newValues.includes('all') || newValues.length === 0) {
      setFilter(new Set<ActivityKind>())
      return
    }

    const nextKinds = new Set<ActivityKind>()
    for (const v of newValues) {
      const spec = FILTER_SPECS.find((s) => s.value === v)
      if (spec !== undefined) {
        for (const k of spec.kinds) {
          nextKinds.add(k)
        }
      }
    }
    setFilter(nextKinds)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderBottom: `1px solid ${TOKENS.borderLight}`,
        bgcolor: 'background.default',
      }}
    >
      <ToggleButtonGroup
        value={selected}
        onChange={handleChange}
        size="small"
        sx={{ gap: 0.25 }}
      >
        {FILTER_SPECS.map((spec) => (
          <ToggleButton
            key={spec.value}
            value={spec.value}
            sx={{
              px: 1,
              py: 0.25,
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              border: `1px solid ${TOKENS.borderMedium}`,
              borderRadius: '4px !important',
              color: 'text.secondary',
              '&.Mui-selected': {
                color: TOKENS.selectionAccent,
                bgcolor: TOKENS.selectionBg,
                borderColor: TOKENS.selectionAccent,
              },
              '&:hover': { bgcolor: TOKENS.surfaceHover },
            }}
          >
            {spec.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  )
}
