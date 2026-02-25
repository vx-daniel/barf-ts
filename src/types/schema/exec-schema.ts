import { z } from 'zod'

/**
 * Output captured from a subprocess spawned by `execFileNoThrow`.
 *
 * `status` is the process exit code (0 = success). Errors appear in `stderr`;
 * the function never throws.
 *
 * @category Utilities
 */
export const ExecResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  status: z.number(),
})
/** A validated exec result. Derived from {@link ExecResultSchema}. */
export type ExecResult = z.infer<typeof ExecResultSchema>
