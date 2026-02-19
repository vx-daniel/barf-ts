import { spawn } from 'bun'

/**
 * Output captured from a subprocess spawned by {@link execFileNoThrow}.
 * `status` is the process exit code (0 = success). Errors appear in `stderr`; the function never throws.
 *
 * @category Utilities
 */
export interface ExecResult {
  stdout: string
  stderr: string
  status: number
}

/**
 * Runs a subprocess without a shell — args are passed as an array, preventing
 * shell injection. Never throws; errors surface as non-zero status + stderr.
 *
 * @category Utilities
 */
export async function execFileNoThrow(file: string, args: string[] = []): Promise<ExecResult> {
  const proc = spawn({ cmd: [file, ...args], stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, status] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  return { stdout, stderr, status }
}
