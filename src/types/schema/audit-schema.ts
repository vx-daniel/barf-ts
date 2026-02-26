/** @module Configuration */
import { z } from 'zod'

/**
 * Categories of audit findings produced by the AI review phase.
 *
 * @category Audit
 */
export const AuditCategorySchema = z.enum([
  'failing_check',
  'unmet_criteria',
  'rule_violation',
  'production_readiness',
])
/** A finding category. Derived from {@link AuditCategorySchema}. */
export type AuditCategory = z.infer<typeof AuditCategorySchema>

/**
 * Severity levels for audit findings.
 *
 * @category Audit
 */
export const AuditSeveritySchema = z.enum(['error', 'warning'])
/** A finding severity. Derived from {@link AuditSeveritySchema}. */
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>

/**
 * A single audit finding reported by the AI reviewer.
 *
 * @category Audit
 */
export const AuditFindingSchema = z.object({
  category: AuditCategorySchema,
  severity: AuditSeveritySchema,
  title: z.string(),
  detail: z.string(),
})
/** A validated audit finding. Derived from {@link AuditFindingSchema}. */
export type AuditFinding = z.infer<typeof AuditFindingSchema>

/**
 * Structured response from the AI audit review.
 *
 * Discriminated on `pass`:
 * - `{ pass: true }` — audit passed, no issues found
 * - `{ pass: false, findings: [...] }` — audit failed with at least one finding
 *
 * @category Audit
 */
export const AuditResponseSchema = z.discriminatedUnion('pass', [
  z.object({ pass: z.literal(true) }),
  z.object({
    pass: z.literal(false),
    findings: z.array(AuditFindingSchema).min(1),
  }),
])
/** A validated audit response. Derived from {@link AuditResponseSchema}. */
export type AuditResponse = z.infer<typeof AuditResponseSchema>
