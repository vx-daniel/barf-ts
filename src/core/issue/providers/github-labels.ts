/**
 * GitHub label mapping — bidirectional conversion between barf states and GitHub labels.
 *
 * The GitHub issue provider uses labels prefixed with `barf:` to represent
 * barf issue states. This module provides the mapping tables and conversion
 * functions used by {@link GitHubIssueProvider}.
 *
 * @module Issue Providers
 */
import { z } from 'zod'
import type { Issue, IssueState } from '@/types'

/**
 * Maps barf issue states to their corresponding GitHub label names.
 *
 * Every state in the {@link IssueStateSchema} has a corresponding label.
 * Labels use the `barf:` prefix followed by a lowercase hyphenated version
 * of the state name.
 *
 * @category Issue Providers
 */
export const STATE_TO_LABEL: Record<IssueState, string> = {
  NEW: 'barf:new',
  PLANNED: 'barf:planned',
  IN_PROGRESS: 'barf:in-progress',
  STUCK: 'barf:stuck',
  SPLIT: 'barf:split',
  COMPLETED: 'barf:completed',
  VERIFIED: 'barf:verified',
}

/**
 * Reverse mapping: GitHub label names to barf issue states.
 *
 * Derived from {@link STATE_TO_LABEL} by swapping keys and values.
 * Used when parsing GitHub issue responses to determine the barf state.
 *
 * @category Issue Providers
 */
export const LABEL_TO_STATE: Record<string, IssueState> = Object.fromEntries(
  (Object.entries(STATE_TO_LABEL) as [IssueState, string][]).map(([s, l]) => [
    l,
    s,
  ]),
)

/**
 * Zod schema for a GitHub issue API response.
 *
 * Validates the subset of fields barf cares about: number, title, body,
 * open/closed state, labels, and optional milestone. The `body` field
 * uses a nullable transform since GitHub returns `null` for empty bodies.
 *
 * @category Issue Providers
 */
export const GHIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.object({ name: z.string() })),
  milestone: z.object({ number: z.number(), title: z.string() }).nullable(),
})

/**
 * Parsed GitHub issue. Derived from {@link GHIssueSchema}.
 *
 * @category Issue Providers
 */
export type GHIssue = z.infer<typeof GHIssueSchema>

/**
 * Converts a GitHub issue API response into a barf {@link Issue}.
 *
 * Determines the barf state by checking:
 * 1. If the issue is closed → `COMPLETED`
 * 2. If a `barf:*` state label exists → corresponding state
 * 3. Otherwise → `NEW`
 *
 * Fields not tracked by GitHub (split_count, verify_count, tokens, etc.)
 * are initialized to their default zero values.
 *
 * @param gh - Parsed GitHub issue from the API.
 * @returns A barf issue with state derived from GitHub labels.
 * @category Issue Providers
 */
export function ghToIssue(gh: GHIssue): Issue {
  const stateLabel = gh.labels.find((l) => LABEL_TO_STATE[l.name])
  let state: IssueState
  if (gh.state === 'closed') {
    state = 'COMPLETED'
  } else if (stateLabel) {
    state = LABEL_TO_STATE[stateLabel.name]
  } else {
    state = 'NEW'
  }
  return {
    id: String(gh.number),
    title: gh.title,
    state,
    parent: '',
    children: [],
    split_count: 0,
    force_split: false,
    verify_count: 0,
    body: gh.body,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_duration_seconds: 0,
    total_iterations: 0,
    run_count: 0,
  }
}
