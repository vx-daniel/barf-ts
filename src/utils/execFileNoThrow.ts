/** @module Utilities */
import { spawn } from 'bun'
import type { ExecResult } from '@/types/schema/exec-schema'

export type { ExecResult } from '@/types/schema/exec-schema'

/**
 * Runs a subprocess without a shell — args are passed as an array, preventing
 * shell injection. Never throws; errors surface as non-zero status + stderr.
 *
 * @category Utilities
 */
export async function execFileNoThrow(
  file: string,
  args: string[] = [],
): Promise<ExecResult> {
  const proc = spawn({ cmd: [file, ...args], stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, status] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, status }
}
