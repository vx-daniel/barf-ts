import { readFileSync } from 'fs'
import { err, ok, type Result } from 'neverthrow'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { z } from 'zod'
import { type Config, ConfigSchema } from '@/types/index'

const KEY_MAP: Record<string, keyof Config> = {
  ISSUES_DIR: 'issuesDir',
  PLAN_DIR: 'planDir',
  CONTEXT_USAGE_PERCENT: 'contextUsagePercent',
  MAX_AUTO_SPLITS: 'maxAutoSplits',
  MAX_ITERATIONS: 'maxIterations',
  CLAUDE_TIMEOUT: 'claudeTimeout',
  TEST_COMMAND: 'testCommand',
  FIX_COMMANDS: 'fixCommands',
  AUDIT_MODEL: 'auditModel',
  TRIAGE_MODEL: 'triageModel',
  PLAN_MODEL: 'planModel',
  BUILD_MODEL: 'buildModel',
  SPLIT_MODEL: 'splitModel',
  OPENAI_API_KEY: 'openaiApiKey',
  AUDIT_PROVIDER: 'auditProvider',
  GEMINI_API_KEY: 'geminiApiKey',
  GEMINI_MODEL: 'geminiModel',
  ANTHROPIC_API_KEY: 'anthropicApiKey',
  CLAUDE_AUDIT_MODEL: 'claudeAuditModel',
  EXTENDED_CONTEXT_MODEL: 'extendedContextModel',
  PUSH_STRATEGY: 'pushStrategy',
  ISSUE_PROVIDER: 'issueProvider',
  GITHUB_REPO: 'githubRepo',
  STREAM_LOG_DIR: 'streamLogDir',
  BARF_DIR: 'barfDir',
  PROMPT_DIR: 'promptDir',
  LOG_FILE: 'logFile',
  LOG_LEVEL: 'logLevel',
  LOG_PRETTY: 'logPretty',
}

// Zod schema that coerces string values (all .barfrc values are strings)
const RawConfigSchema = ConfigSchema.extend({
  contextUsagePercent: z.coerce.number().int().default(75),
  maxAutoSplits: z.coerce.number().int().default(3),
  maxIterations: z.coerce.number().int().default(0),
  claudeTimeout: z.coerce.number().int().default(3600),
  streamLogDir: z.coerce.string().default(''),
  fixCommands: z
    .preprocess(
      (v) =>
        typeof v === 'string'
          ? v
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : (v ?? []),
      z.array(z.string()),
    )
    .default([]),
  logPretty: z
    .preprocess((v) => v === '1' || v === 'true' || v === true, z.boolean())
    .default(false),
})

/**
 * Parses a `.barfrc` KEY=VALUE string into a validated {@link Config}.
 *
 * Only recognises keys listed in the internal KEY_MAP; unknown keys are silently ignored.
 *
 * @param content - Raw `.barfrc` file contents.
 * @returns `ok(Config)` on success, `err(ZodError)` if a required field fails validation.
 * @category Configuration
 */
export function parseBarfrc(content: string): Result<Config, z.ZodError> {
  const raw: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      continue
    }
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    const mapped = KEY_MAP[key]
    if (mapped) {
      raw[mapped] = val
    }
  }
  const parsed = RawConfigSchema.safeParse(raw)
  return parsed.success ? ok(parsed.data) : err(parsed.error)
}

/**
 * Reads an OpenAI API key or OAuth access token from `~/.codex/auth.json`.
 * Tries `OPENAI_API_KEY` first (explicit key), then `tokens.access_token` (OAuth bearer).
 *
 * @returns Token string, or empty string if the file is missing or unparseable.
 */
function readCodexToken(): string {
  try {
    const authPath = join(homedir(), '.codex', 'auth.json')
    const raw = readFileSync(authPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) {
      return ''
    }
    const auth = parsed as Record<string, unknown>
    if (
      typeof auth.OPENAI_API_KEY === 'string' &&
      auth.OPENAI_API_KEY.length > 0
    ) {
      return auth.OPENAI_API_KEY
    }
    const tokens = auth.tokens
    if (typeof tokens === 'object' && tokens !== null) {
      const t = tokens as Record<string, unknown>
      if (typeof t.access_token === 'string' && t.access_token.length > 0) {
        return t.access_token
      }
    }
    return ''
  } catch {
    return ''
  }
}

/**
 * Loads barf configuration from a `.barfrc` file.
 *
 * Falls back to schema defaults if the file is missing or cannot be parsed.
 * Never throws — invalid config is silently replaced with defaults.
 *
 * @param rcPath - Path to the `.barfrc` file. Defaults to `<cwd>/.barfrc`.
 * @category Configuration
 */
export function loadConfig(rcPath?: string): Config {
  const filePath = rcPath ? resolve(rcPath) : join(process.cwd(), '.barfrc')
  let config: Config
  try {
    const content = readFileSync(filePath, 'utf8')
    config = parseBarfrc(content).match(
      (c) => c,
      () => RawConfigSchema.parse({}),
    )
  } catch {
    config = RawConfigSchema.parse({})
  }

  if (config.openaiApiKey === '') {
    const codexToken = readCodexToken()
    if (codexToken) {
      config = { ...config, openaiApiKey: codexToken }
    }
  }

  return config
}
