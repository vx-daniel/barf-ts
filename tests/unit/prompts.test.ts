import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { resolvePromptTemplate, type PromptMode } from '@/core/prompts'
import type { Config } from '@/types'

/** Minimal config with defaults for testing. */
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    issuesDir: 'issues',
    planDir: 'plans',
    contextUsagePercent: 75,
    maxAutoSplits: 3,
    maxIterations: 0,
    claudeTimeout: 3600,
    testCommand: '',
    interviewModel: 'claude-sonnet-4-6',
    auditModel: 'gpt-4o',
    openaiApiKey: '',
    planModel: 'claude-opus-4-6',
    buildModel: 'claude-sonnet-4-6',
    splitModel: 'claude-sonnet-4-6',
    extendedContextModel: 'claude-opus-4-6',
    pushStrategy: 'iteration',
    issueProvider: 'local',
    githubRepo: '',
    streamLogDir: '',
    barfDir: '.barf',
    promptDir: '',
    auditProvider: 'openai' as const,
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-pro',
    ...overrides
  }
}

describe('resolvePromptTemplate', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'barf-prompts-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true })
  })

  it('returns built-in when promptDir is empty', () => {
    const config = makeConfig({ promptDir: '' })
    const result = resolvePromptTemplate('plan', config)
    expect(result.length).toBeGreaterThan(0)
    expect(typeof result).toBe('string')
  })

  it('returns built-in when promptDir is set but file missing', () => {
    const config = makeConfig({ promptDir: tmpDir })
    const result = resolvePromptTemplate('build', config)
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns custom file contents when found', () => {
    const customContent = '# Custom Plan Prompt\nDo the thing.\n'
    writeFileSync(join(tmpDir, 'PROMPT_plan.md'), customContent)
    const config = makeConfig({ promptDir: tmpDir })
    const result = resolvePromptTemplate('plan', config)
    expect(result).toBe(customContent)
  })

  it('falls back per-mode: custom plan, built-in build', () => {
    const customContent = '# Custom Plan\n'
    writeFileSync(join(tmpDir, 'PROMPT_plan.md'), customContent)
    const config = makeConfig({ promptDir: tmpDir })

    expect(resolvePromptTemplate('plan', config)).toBe(customContent)
    // build should still return the built-in (non-empty)
    const buildResult = resolvePromptTemplate('build', config)
    expect(buildResult).not.toBe(customContent)
    expect(buildResult.length).toBeGreaterThan(0)
  })

  it('resolves all four modes correctly', () => {
    const modes: PromptMode[] = ['plan', 'build', 'split', 'interview']
    const config = makeConfig({ promptDir: '' })
    for (const mode of modes) {
      const result = resolvePromptTemplate(mode, config)
      expect(result.length).toBeGreaterThan(0)
    }
  })
})
