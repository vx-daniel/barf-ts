import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { okAsync } from 'neverthrow'
import type { ExecResult } from '@/utils/execFileNoThrow'

/**
 * Integration tests for the full audit pipeline.
 *
 * Mock boundary: only execFn (injected via AuditDeps). The real
 * CodexAuditProvider, real chatJSON chain, real loadRulesContext,
 * and real temp filesystem all run.
 */

const capturedCodexPrompts: string[] = []
const execState = {
  codexStatus: 0,
  codexStdout: '{"pass":true}',
  toolStatus: 0,
}

async function mockExecFn(
  file: string,
  args: string[] = [],
): Promise<ExecResult> {
  if (file === 'codex') {
    // Prompt is the last arg: codex exec --full-auto --ephemeral <prompt>
    capturedCodexPrompts.push(args[args.length - 1])
    return {
      stdout: execState.codexStdout,
      stderr: '',
      status: execState.codexStatus,
    }
  }
  // bun run lint / bun run format:check / sh -c testCommand
  return { stdout: '', stderr: '', status: execState.toolStatus }
}

import { auditCommand } from '@/cli/commands/audit'
import { CodexAuditProvider } from '@/providers/codex'
import {
  defaultConfig,
  makeIssue,
  makeProvider,
} from '@tests/fixtures/provider'

const originalCwd = process.cwd()

describe('audit-pipeline integration', () => {
  let tmpDir: string

  beforeEach(() => {
    capturedCodexPrompts.length = 0
    execState.codexStatus = 0
    execState.codexStdout = '{"pass":true}'
    execState.toolStatus = 0
    process.exitCode = 0

    tmpDir = mkdtempSync(join(tmpdir(), 'barf-int-'))
    mkdirSync(join(tmpDir, 'issues'), { recursive: true })
    mkdirSync(join(tmpDir, 'plans'), { recursive: true })
    mkdirSync(join(tmpDir, '.claude', 'rules'), { recursive: true })

    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(tmpDir, { recursive: true, force: true })
    process.exitCode = 0
  })

  function makeConfig(overrides: Record<string, unknown> = {}) {
    return {
      ...defaultConfig(),
      auditProvider: 'codex' as const,
      issuesDir: join(tmpDir, 'issues'),
      planDir: join(tmpDir, 'plans'),
      ...overrides,
    }
  }

  function makeDeps(config: ReturnType<typeof makeConfig>) {
    return {
      execFn: mockExecFn,
      provider: new CodexAuditProvider(config, mockExecFn),
    }
  }

  it('CLAUDE.md content appears in codex prompt', async () => {
    writeFileSync(
      join(tmpDir, 'CLAUDE.md'),
      '# Project Rules\n\nNo any types.\n',
    )

    const config = makeConfig()
    const issue = makeIssue({ id: '001', state: 'BUILT' })
    const provider = makeProvider({ fetchIssue: () => okAsync(issue) })

    await auditCommand(
      provider,
      { issue: '001', all: false },
      config,
      makeDeps(config),
    )

    expect(capturedCodexPrompts).toHaveLength(1)
    expect(capturedCodexPrompts[0]).toContain('No any types.')
  })

  it('.claude/rules/ files are loaded into prompt', async () => {
    writeFileSync(
      join(tmpDir, '.claude', 'rules', 'typescript-advanced.md'),
      '# TypeScript Rules\n\nUse satisfies keyword.\n',
    )

    const config = makeConfig()
    const issue = makeIssue({ id: '001', state: 'BUILT' })
    const provider = makeProvider({ fetchIssue: () => okAsync(issue) })

    await auditCommand(
      provider,
      { issue: '001', all: false },
      config,
      makeDeps(config),
    )

    expect(capturedCodexPrompts).toHaveLength(1)
    expect(capturedCodexPrompts[0]).toContain('Use satisfies keyword.')
  })

  it('plan file content appears in codex prompt when file exists', async () => {
    const planContent = '# Plan 001\n\nImplement user auth with JWT.\n'
    writeFileSync(join(tmpDir, 'plans', '001.md'), planContent)

    const config = makeConfig()
    const issue = makeIssue({ id: '001', state: 'BUILT' })
    const provider = makeProvider({ fetchIssue: () => okAsync(issue) })

    await auditCommand(
      provider,
      { issue: '001', all: false },
      config,
      makeDeps(config),
    )

    expect(capturedCodexPrompts).toHaveLength(1)
    expect(capturedCodexPrompts[0]).toContain('Implement user auth with JWT.')
  })

  it('missing plan file produces "(no plan file found)" in prompt', async () => {
    // No plan file written — plans dir is empty

    const config = makeConfig()
    const issue = makeIssue({ id: '001', state: 'BUILT' })
    const provider = makeProvider({ fetchIssue: () => okAsync(issue) })

    await auditCommand(
      provider,
      { issue: '001', all: false },
      config,
      makeDeps(config),
    )

    expect(capturedCodexPrompts).toHaveLength(1)
    expect(capturedCodexPrompts[0]).toContain('(no plan file found)')
  })

  it('findings with multiple categories produce full body in created issue', async () => {
    execState.codexStdout = JSON.stringify({
      pass: false,
      findings: [
        {
          category: 'failing_check',
          severity: 'error',
          title: 'Tests broken',
          detail: '3 tests fail',
        },
        {
          category: 'rule_violation',
          severity: 'warning',
          title: 'Used any type',
          detail: 'Found any in src/foo.ts',
        },
      ],
    })

    const config = makeConfig()
    const issue = makeIssue({
      id: '001',
      state: 'BUILT',
      title: 'Add feature',
    })
    let createdBody = ''
    const provider = makeProvider({
      fetchIssue: () => okAsync(issue),
      createIssue: (input) => {
        createdBody = input.body ?? ''
        return okAsync(makeIssue({ id: '002', title: input.title }))
      },
    })

    await auditCommand(
      provider,
      { issue: '001', all: false },
      config,
      makeDeps(config),
    )

    expect(createdBody).toContain('Failing Checks')
    expect(createdBody).toContain('Tests broken')
    expect(createdBody).toContain('3 tests fail')
    expect(createdBody).toContain('Rule Violations')
    expect(createdBody).toContain('Used any type')
    expect(createdBody).toContain('Found any in src/foo.ts')
  })

  it('--all mode: 2 BUILT issues are each sent to codex', async () => {
    const issue1 = makeIssue({
      id: '001',
      state: 'BUILT',
      title: 'Feature A',
    })
    const issue2 = makeIssue({
      id: '002',
      state: 'BUILT',
      title: 'Feature B',
    })

    const issueMap: Record<string, typeof issue1> = {
      '001': issue1,
      '002': issue2,
    }

    const config = makeConfig()
    const provider = makeProvider({
      listIssues: () => okAsync([issue1, issue2]),
      fetchIssue: (id) => okAsync(issueMap[id]!),
    })

    await auditCommand(provider, { all: true }, config, makeDeps(config))

    // Both issues trigger a codex call
    expect(capturedCodexPrompts).toHaveLength(2)
    expect(process.exitCode).toBe(0)
  })
})
