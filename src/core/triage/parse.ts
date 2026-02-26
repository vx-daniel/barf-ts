/**
 * Triage response parsing — validates and formats Claude's triage output.
 *
 * Claude returns a JSON object indicating whether the issue needs an interview.
 * This module handles parsing that response, stripping markdown code fences,
 * and formatting interview questions as markdown for the issue body.
 *
 * @module triage/parse
 */
import { z } from 'zod'
import { toError } from '@/utils/toError'

/**
 * JSON shape Claude must return for a triage evaluation.
 *
 * Two possible outcomes:
 * - `{ needs_interview: false }` — issue is well-specified, ready for planning
 * - `{ needs_interview: true, questions: [...] }` — issue needs refinement
 *
 * @category Triage
 */
export const TriageResultSchema = z.union([
  z.object({ needs_interview: z.literal(false) }),
  z.object({
    needs_interview: z.literal(true),
    questions: z.array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).optional(),
      }),
    ),
  }),
])

/**
 * Parsed triage result. Derived from {@link TriageResultSchema}.
 *
 * @category Triage
 */
export type TriageResult = z.infer<typeof TriageResultSchema>

/**
 * Formats interview questions as a numbered markdown list.
 *
 * Produces a `## Interview Questions` section suitable for appending
 * to an issue body. Each question is numbered, and optional multiple-choice
 * options are rendered as indented bullet points.
 *
 * @param result - Triage result with `needs_interview: true` and questions.
 * @returns Markdown string starting with `\n\n## Interview Questions\n\n`.
 * @category Triage
 */
export function formatQuestionsSection(
  result: TriageResult & { needs_interview: true },
): string {
  const items = result.questions
    .map((q, i) => {
      const opts = q.options?.map((o) => `   - ${o}`).join('\n') ?? ''
      return opts
        ? `${i + 1}. ${q.question}\n${opts}`
        : `${i + 1}. ${q.question}`
    })
    .join('\n')
  return `\n\n## Interview Questions\n\n${items}`
}

/**
 * Parses Claude's raw triage response into a validated {@link TriageResult}.
 *
 * Handles markdown code fences that Claude sometimes wraps around JSON
 * despite instructions not to. Strips the fences, parses JSON, and
 * validates against {@link TriageResultSchema}.
 *
 * @param stdout - Raw stdout from the Claude triage subprocess.
 * @returns Validated triage result.
 * @throws Error if the response cannot be parsed or doesn't match the schema.
 * @category Triage
 */
export function parseTriageResponse(stdout: string): TriageResult {
  try {
    // Strip markdown code fences Claude sometimes adds despite instructions
    const raw = stdout
      .trim()
      .replace(/^```(?:json)?\n?([\s\S]*?)\n?```$/m, '$1')
      .trim()
    const parseResult = TriageResultSchema.safeParse(JSON.parse(raw))
    if (!parseResult.success) {
      throw new Error(
        `Unexpected triage JSON shape: ${JSON.stringify(parseResult.error.issues)}`,
      )
    }
    return parseResult.data
  } catch (e) {
    throw new Error(`Failed to parse triage response: ${toError(e).message}`)
  }
}
