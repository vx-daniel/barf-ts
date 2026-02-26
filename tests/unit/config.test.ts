import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parseBarfrc, loadConfig } from '@/core/config'

describe('parseBarfrc', () => {
  it('returns defaults when content is empty', () => {
    const result = parseBarfrc('')
    expect(result.isOk()).toBe(true)
    const config = result._unsafeUnwrap()
    expect(config.issuesDir).toBe('issues')
    expect(config.issueProvider).toBe('local')
    expect(config.githubRepo).toBe('')
  })

  it('parses ISSUE_PROVIDER=github and GITHUB_REPO', () => {
    const result = parseBarfrc(
      'ISSUE_PROVIDER=github\nGITHUB_REPO=owner/repo\n',
    )
    const config = result._unsafeUnwrap()
    expect(config.issueProvider).toBe('github')
    expect(config.githubRepo).toBe('owner/repo')
  })

  it('ignores comments and blank lines', () => {
    const result = parseBarfrc('# comment\n\nISSUES_DIR=.barf/issues\n')
    expect(result._unsafeUnwrap().issuesDir).toBe('.barf/issues')
  })

  it('coerces numeric strings to numbers', () => {
    const result = parseBarfrc('CONTEXT_USAGE_PERCENT=80\nMAX_AUTO_SPLITS=5\n')
    const config = result._unsafeUnwrap()
    expect(config.contextUsagePercent).toBe(80)
    expect(config.maxAutoSplits).toBe(5)
  })

  it('returns Err on invalid ISSUE_PROVIDER value', () => {
    const result = parseBarfrc('ISSUE_PROVIDER=linear\n')
    expect(result.isErr()).toBe(true)
  })

  it('parses PROMPT_DIR into config.promptDir', () => {
    const result = parseBarfrc('PROMPT_DIR=./my-prompts\n')
    expect(result._unsafeUnwrap().promptDir).toBe('./my-prompts')
  })

  it('defaults promptDir to empty string when missing', () => {
    const result = parseBarfrc('')
    expect(result._unsafeUnwrap().promptDir).toBe('')
  })

  it('parses AUDIT_PROVIDER=gemini', () => {
    const result = parseBarfrc('AUDIT_PROVIDER=gemini')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.auditProvider).toBe('gemini')
    }
  })

  it('defaults auditProvider to openai', () => {
    const result = parseBarfrc('')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.auditProvider).toBe('openai')
    }
  })

  it('parses GEMINI_API_KEY', () => {
    const result = parseBarfrc('GEMINI_API_KEY=mykey')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.geminiApiKey).toBe('mykey')
    }
  })

  it('parses GEMINI_MODEL', () => {
    const result = parseBarfrc('GEMINI_MODEL=gemini-2.0-flash')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.geminiModel).toBe('gemini-2.0-flash')
    }
  })

  it('defaults geminiModel to gemini-1.5-pro', () => {
    const result = parseBarfrc('')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.geminiModel).toBe('gemini-1.5-pro')
    }
  })

  it('parses AUDIT_PROVIDER=claude', () => {
    const result = parseBarfrc('AUDIT_PROVIDER=claude')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.auditProvider).toBe('claude')
    }
  })

  it('parses ANTHROPIC_API_KEY', () => {
    const result = parseBarfrc('ANTHROPIC_API_KEY=sk-ant-test')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.anthropicApiKey).toBe('sk-ant-test')
    }
  })

  it('defaults anthropicApiKey to empty string', () => {
    const result = parseBarfrc('')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.anthropicApiKey).toBe('')
    }
  })

  it('parses CLAUDE_AUDIT_MODEL', () => {
    const result = parseBarfrc('CLAUDE_AUDIT_MODEL=claude-opus-4-6')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.claudeAuditModel).toBe('claude-opus-4-6')
    }
  })

  it('defaults claudeAuditModel to claude-sonnet-4-6', () => {
    const result = parseBarfrc('')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.claudeAuditModel).toBe('claude-sonnet-4-6')
    }
  })

  it('parses LOG_FILE into logFile', () => {
    const result = parseBarfrc('LOG_FILE=custom.log')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.logFile).toBe('custom.log')
    }
  })

  it('defaults logFile to barf.log', () => {
    const result = parseBarfrc('')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.logFile).toBe('barf.log')
    }
  })

  it('parses LOG_LEVEL=debug into logLevel', () => {
    const result = parseBarfrc('LOG_LEVEL=debug')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.logLevel).toBe('debug')
    }
  })

  it('parses LOG_PRETTY=1 into logPretty=true', () => {
    const result = parseBarfrc('LOG_PRETTY=1')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.logPretty).toBe(true)
    }
  })

  it('parses FIX_COMMANDS from .barfrc', () => {
    const result = parseBarfrc('FIX_COMMANDS=biome check --apply,bun run lint --fix')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().fixCommands).toEqual([
      'biome check --apply',
      'bun run lint --fix',
    ])
  })

  it('defaults fixCommands to empty array', () => {
    const result = parseBarfrc('')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().fixCommands).toEqual([])
  })

  it('defaults logPretty to false', () => {
    const result = parseBarfrc('')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.logPretty).toBe(false)
    }
  })
})

describe('loadConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'barf-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true })
  })

  it('reads config from explicit file path', () => {
    const rcPath = join(tmpDir, 'custom.rc')
    writeFileSync(rcPath, 'ISSUES_DIR=custom-issues\n')
    const config = loadConfig(rcPath)
    expect(config.issuesDir).toBe('custom-issues')
  })

  it('falls back to defaults when explicit file does not exist', () => {
    const config = loadConfig(join(tmpDir, 'nonexistent.rc'))
    expect(config.issuesDir).toBe('issues')
  })

  it('falls back to defaults when called with no args', () => {
    const config = loadConfig()
    expect(config.issuesDir).toBe('issues')
  })
})
