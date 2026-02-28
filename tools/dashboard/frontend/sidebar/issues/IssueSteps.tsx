/**
 * Horizontal pipeline progress stepper for the issue lifecycle.
 *
 * Shows the six {@link PIPELINE_STATES} as MUI Stepper steps. The active step
 * is derived from the issue's current state index in `PIPELINE_STATES`.
 * Side-states (`STUCK`, `SPLIT`) fall outside the pipeline and are rendered
 * by showing all steps as neutral (no active/completed highlighting) plus a
 * warning chip next to the stepper.
 */
import type React from 'react'
import Box from '@mui/material/Box'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Chip from '@mui/material/Chip'
import {
  PIPELINE_STATES,
  STATE_LABELS,
  STATE_COLORS,
} from '@dashboard/frontend/common/utils/constants'
import type { Issue } from '@/types/schema/issue-schema'
import type { IssueState } from '@/types/schema/issue-schema'

interface IssueStepsProps {
  /** The issue whose state drives the stepper position. */
  issue: Issue
}

const SIDE_STATES = new Set<IssueState>(['STUCK', 'SPLIT'])

/**
 * Derives the active step index for the MUI Stepper.
 * Returns -1 for side-states so no step appears active.
 *
 * @param state - Current issue state.
 * @returns Zero-based step index, or -1 for side-states.
 */
function activeStepFor(state: IssueState): number {
  if (SIDE_STATES.has(state)) return -1
  const idx = PIPELINE_STATES.indexOf(state)
  return idx === -1 ? 0 : idx
}

/**
 * Pipeline progress stepper rendered above the issue panel tabs.
 *
 * @param issue - The issue to reflect.
 * @returns A compact horizontal stepper with optional side-state badge.
 */
export function IssueSteps({ issue }: IssueStepsProps): React.JSX.Element {
  const isSideState = SIDE_STATES.has(issue.state as IssueState)
  const activeStep = activeStepFor(issue.state as IssueState)

  return (
    <Box
      sx={{
        px: 1.5,
        pt: 1,
        pb: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Stepper
          activeStep={isSideState ? -1 : activeStep}
          sx={{
            flex: 1,
            '& .MuiStepLabel-label': { fontSize: '0.5625rem', mt: 0.25 },
            '& .MuiStepIcon-root': { width: 16, height: 16 },
            '& .MuiStep-root': { px: 0.25 },
          }}
        >
          {PIPELINE_STATES.map((state) => (
            <Step
              key={state}
              completed={
                !isSideState && PIPELINE_STATES.indexOf(state) < activeStep
              }
            >
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label': {
                    color: isSideState ? 'text.disabled' : undefined,
                  },
                }}
              >
                {STATE_LABELS[state]}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {isSideState && (
          <Chip
            label={STATE_LABELS[issue.state as IssueState] ?? issue.state}
            size="small"
            sx={{
              flexShrink: 0,
              fontSize: '0.5625rem',
              height: 18,
              backgroundColor: `${STATE_COLORS[issue.state as IssueState]}22`,
              color: STATE_COLORS[issue.state as IssueState],
              borderColor: `${STATE_COLORS[issue.state as IssueState]}44`,
              border: '1px solid',
              fontWeight: 700,
            }}
          />
        )}
      </Box>
    </Box>
  )
}
