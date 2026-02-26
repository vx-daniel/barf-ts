import { describe, it, expect } from 'bun:test'
import { runPreComplete, toFixSteps } from '@/core/pre-complete'
import type { ExecResult } from '@/utils/execFileNoThrow'
import type { FixStep } from '@/core/pre-complete'

function mockExec(results: Record<string, ExecResult>) {
	return async (_file: string, args: string[] = []): Promise<ExecResult> => {
		const cmd = args.join(' ')
		for (const [pattern, result] of Object.entries(results)) {
			if (cmd.includes(pattern)) return result
		}
		return { stdout: '', stderr: '', status: 0 }
	}
}

const ok: ExecResult = { stdout: '', stderr: '', status: 0 }
const fail: ExecResult = { stdout: 'error output', stderr: 'stderr', status: 1 }

describe('runPreComplete', () => {
	it('returns passed when no fix commands and no test command', async () => {
		const result = await runPreComplete([], undefined, mockExec({}))
		const outcome = result._unsafeUnwrap()
		expect(outcome.passed).toBe(true)
	})

	it('runs fix commands and returns passed when tests pass', async () => {
		const fixes: FixStep[] = [{ name: 'lint', command: 'biome check --apply' }]
		const exec = mockExec({ biome: ok, test: ok })
		const result = await runPreComplete(fixes, 'bun test', exec)
		expect(result._unsafeUnwrap().passed).toBe(true)
	})

	it('returns passed even when fix commands fail', async () => {
		const fixes: FixStep[] = [{ name: 'lint', command: 'biome check --apply' }]
		const exec = mockExec({ biome: fail })
		const result = await runPreComplete(fixes, undefined, exec)
		expect(result._unsafeUnwrap().passed).toBe(true)
	})

	it('returns failed when test command fails', async () => {
		const exec = mockExec({ test: fail })
		const result = await runPreComplete([], 'bun test', exec)
		const outcome = result._unsafeUnwrap()
		expect(outcome.passed).toBe(false)
		if (!outcome.passed) {
			expect(outcome.testFailure.exitCode).toBe(1)
		}
	})

	it('fix command failure does not block test from running', async () => {
		let testRan = false
		const exec = async (_file: string, args: string[] = []): Promise<ExecResult> => {
			const cmd = args.join(' ')
			if (cmd.includes('biome')) return fail
			if (cmd.includes('test')) {
				testRan = true
				return ok
			}
			return ok
		}
		const fixes: FixStep[] = [{ name: 'lint', command: 'biome check --apply' }]
		await runPreComplete(fixes, 'bun test', exec)
		expect(testRan).toBe(true)
	})
})

describe('toFixSteps', () => {
	it('converts command strings to FixStep entries', () => {
		const steps = toFixSteps(['biome check --apply', 'bun run lint --fix'])
		expect(steps).toEqual([
			{ name: 'biome', command: 'biome check --apply' },
			{ name: 'bun', command: 'bun run lint --fix' },
		])
	})

	it('returns empty array for empty input', () => {
		expect(toFixSteps([])).toEqual([])
	})
})
