/** @module Verification */
import { ResultAsync } from 'neverthrow'
import type { ExecFn } from '@/core/verification'
import type { FixStep, PreCompleteResult } from '@/types'

export type { FixStep, PreCompleteResult } from '@/types'

import { execFileNoThrow } from '@/utils/execFileNoThrow'
import { createLogger } from '@/utils/logger'

const logger = createLogger('pre-complete')

/**
 * Converts config `fixCommands` strings into {@link FixStep} entries.
 * Each command string becomes a named step (name derived from first word).
 *
 * @param commands - Raw command strings from config (e.g. `['biome check --apply']`).
 * @returns Array of {@link FixStep} ready for {@link runPreComplete}.
 */
export function toFixSteps(commands: string[]): FixStep[] {
  return commands.map((cmd) => ({
    name: cmd.split(' ')[0] ?? cmd,
    command: cmd,
  }))
}

/**
 * Runs pre-completion checks: fix commands (best-effort) then test gate (hard requirement).
 *
 * Fix commands run sequentially via `sh -c`. Failures are logged but do not block.
 * If `testCommand` is set, it must exit 0 for the result to be `{ passed: true }`.
 *
 * @param fixSteps - Fix commands to run (best-effort).
 * @param testCommand - Shell command that must pass; `undefined` or empty to skip.
 * @param execFn - Injectable subprocess executor.
 * @returns `ok({ passed: true })` or `ok({ passed: false, testFailure })`. Never errors.
 */
export function runPreComplete(
  fixSteps: FixStep[],
  testCommand: string | undefined,
  execFn: ExecFn = execFileNoThrow,
): ResultAsync<PreCompleteResult, never> {
  const run = async (): Promise<PreCompleteResult> => {
    // Run fix commands (best-effort)
    for (const step of fixSteps) {
      logger.debug({ step: step.name }, 'running fix step')
      const result = await execFn('sh', ['-c', step.command])
      if (result.status !== 0) {
        logger.warn(
          { step: step.name, exitCode: result.status },
          'fix step failed — continuing',
        )
      } else {
        logger.debug({ step: step.name }, 'fix step passed')
      }
    }

    // Run test gate
    if (testCommand) {
      logger.debug({ testCommand }, 'running test gate')
      const result = await execFn('sh', ['-c', testCommand])
      if (result.status !== 0) {
        logger.warn({ exitCode: result.status }, 'test gate failed')
        return {
          passed: false,
          testFailure: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.status,
          },
        }
      }
      logger.debug('test gate passed')
    }

    return { passed: true }
  }

  return ResultAsync.fromSafePromise(run())
}
