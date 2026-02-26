/**
 * Configuration schema — runtime settings for a barf project.
 *
 * Loaded from `.barfrc` (KEY=VALUE format) via `loadConfig` in `core/config.ts`.
 * Every key has a sensible default so barf works out of the box with zero configuration.
 *
 * The schema uses Zod's `.default()` on every field, meaning `ConfigSchema.parse({})`
 * returns a fully-populated config object. This is intentional — partial configs are
 * merged with defaults at parse time, not at runtime.
 *
 * @module Configuration
 */
import { z } from 'zod'

/**
 * Runtime configuration for a barf project.
 *
 * Loaded from `.barfrc` (KEY=VALUE format) via `loadConfig`. Falls back to
 * these defaults when the file is absent or a key is missing.
 *
 * Configuration groups:
 * - **Paths**: `issuesDir`, `planDir`, `barfDir`, `promptDir`, `streamLogDir`
 * - **Orchestration**: `contextUsagePercent`, `maxAutoSplits`, `maxIterations`, `claudeTimeout`, `maxVerifyRetries`
 * - **Models**: `planModel`, `buildModel`, `splitModel`, `extendedContextModel`, `triageModel`
 * - **Audit**: `auditProvider`, `auditModel`, `openaiApiKey`, `geminiApiKey`, `anthropicApiKey`
 * - **Testing**: `testCommand`, `fixCommands`
 * - **Git**: `pushStrategy`
 * - **Provider**: `issueProvider`, `githubRepo`
 * - **Logging**: `logFile`, `logLevel`, `logPretty`
 *
 * @category Configuration
 * @group Configuration
 */
export const ConfigSchema = z.object({
  /** Directory where issue markdown files are stored. Relative to project root. */
  issuesDir: z.string().default('issues'),
  /** Directory where plan files are written by the plan mode. */
  planDir: z.string().default('plans'),
  /** Percentage of context window to use before triggering overflow (split/escalate). */
  contextUsagePercent: z.number().int().default(75),
  /** Maximum number of automatic splits before escalating to extended context model. */
  maxAutoSplits: z.number().int().default(3),
  /** Maximum verification retry attempts before marking issue as verify_exhausted. */
  maxVerifyRetries: z.number().int().nonnegative().default(3),
  /** Maximum Claude iterations per run. 0 means unlimited. */
  maxIterations: z.number().int().default(0),
  /** Timeout in seconds for each Claude iteration. */
  claudeTimeout: z.number().int().default(3600),
  /** Shell command to run as the test gate during pre-completion checks. Empty string to skip. */
  testCommand: z.string().default(''),
  /** Shell commands to run as fix steps before the test gate (best-effort, failures don't block). */
  fixCommands: z.array(z.string()).default([]),
  /** Model used for triage one-shot calls. */
  triageModel: z.string().default('claude-haiku-4-5-20251001'),
  /** Model used for audit provider calls. */
  auditModel: z.string().default('gpt-4o'),
  /** OpenAI API key for the OpenAI audit provider. */
  openaiApiKey: z.string().default(''),
  /** Which audit provider to use for code review. */
  auditProvider: z
    .enum(['openai', 'gemini', 'claude', 'codex'])
    .default('openai'),
  /** Google Gemini API key for the Gemini audit provider. */
  geminiApiKey: z.string().default(''),
  /** Gemini model identifier for the Gemini audit provider. */
  geminiModel: z.string().default('gemini-1.5-pro'),
  /** Anthropic API key for the Claude audit provider. */
  anthropicApiKey: z.string().default(''),
  /** Model used by the Claude audit provider. */
  claudeAuditModel: z.string().default('claude-sonnet-4-6'),
  /** Model used for plan mode iterations. */
  planModel: z.string().default('claude-opus-4-6'),
  /** Model used for build mode iterations. */
  buildModel: z.string().default('claude-sonnet-4-6'),
  /** Model used for split mode iterations (after overflow). */
  splitModel: z.string().default('claude-sonnet-4-6'),
  /** Model used when escalating past maxAutoSplits (larger context window). */
  extendedContextModel: z.string().default('claude-opus-4-6'),
  /** When to push commits: after each iteration, on completion, or manually. */
  pushStrategy: z
    .enum(['iteration', 'on_complete', 'manual'])
    .default('iteration'),
  /** Issue storage backend: local filesystem or GitHub Issues. */
  issueProvider: z.enum(['local', 'github']).default('local'),
  /** GitHub repository slug (owner/repo) for the GitHub issue provider. */
  githubRepo: z.string().default(''),
  /** Directory for raw JSONL stream logs. Empty string disables logging. */
  streamLogDir: z.string().default(''),
  /** Directory for barf internal state (lock files, etc.). */
  barfDir: z.string().default('.barf'),
  /** Directory for custom prompt templates. Empty string uses built-in prompts. */
  promptDir: z.string().default(''),
  /** Path to the pino log file. */
  logFile: z.string().default('.barf/barf.jsonl'),
  /** Pino log level (trace, debug, info, warn, error, fatal). */
  logLevel: z.string().default('info'),
  /** Enable pretty-printed log output (for development). */
  logPretty: z.boolean().default(false),
})

/**
 * Validated barf runtime configuration. Derived from {@link ConfigSchema}.
 *
 * @category Configuration
 * @group Configuration
 */
export type Config = z.infer<typeof ConfigSchema>
