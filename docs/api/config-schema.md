[**barf**](README.md)

***

[barf](modules.md) / config-schema

# config-schema

Configuration schema — runtime settings for a barf project.

Loaded from `.barfrc` (KEY=VALUE format) via `loadConfig` in `core/config.ts`.
Every key has a sensible default so barf works out of the box with zero configuration.

The schema uses Zod's `.default()` on every field, meaning `ConfigSchema.parse({})`
returns a fully-populated config object. This is intentional — partial configs are
merged with defaults at parse time, not at runtime.

## Configuration

### Config

> **Config** = `object`

Defined in: src/types/schema/config-schema.ts:107

Validated barf runtime configuration. Derived from [ConfigSchema](#configschema).

#### Type Declaration

##### anthropicApiKey

> **anthropicApiKey**: `string`

Anthropic API key for the Claude audit provider.

##### auditModel

> **auditModel**: `string`

Model used for audit provider calls.

##### auditProvider

> **auditProvider**: `"openai"` \| `"gemini"` \| `"claude"` \| `"codex"`

Which audit provider to use for code review.

##### barfDir

> **barfDir**: `string`

Directory for barf internal state (lock files, etc.).

##### buildModel

> **buildModel**: `string`

Model used for build mode iterations.

##### claudeAuditModel

> **claudeAuditModel**: `string`

Model used by the Claude audit provider.

##### claudeTimeout

> **claudeTimeout**: `number`

Timeout in seconds for each Claude iteration.

##### contextUsagePercent

> **contextUsagePercent**: `number`

Percentage of context window to use before triggering overflow (split/escalate).

##### extendedContextModel

> **extendedContextModel**: `string`

Model used when escalating past maxAutoSplits (larger context window).

##### fixCommands

> **fixCommands**: `string`[]

Shell commands to run as fix steps before the test gate (best-effort, failures don't block).

##### geminiApiKey

> **geminiApiKey**: `string`

Google Gemini API key for the Gemini audit provider.

##### geminiModel

> **geminiModel**: `string`

Gemini model identifier for the Gemini audit provider.

##### githubRepo

> **githubRepo**: `string`

GitHub repository slug (owner/repo) for the GitHub issue provider.

##### issueProvider

> **issueProvider**: `"local"` \| `"github"`

Issue storage backend: local filesystem or GitHub Issues.

##### issuesDir

> **issuesDir**: `string`

Directory where issue markdown files are stored. Relative to project root.

##### logFile

> **logFile**: `string`

Path to the pino log file.

##### logLevel

> **logLevel**: `string`

Pino log level (trace, debug, info, warn, error, fatal).

##### logPretty

> **logPretty**: `boolean`

Enable pretty-printed log output (for development).

##### maxAutoSplits

> **maxAutoSplits**: `number`

Maximum number of automatic splits before escalating to extended context model.

##### maxIterations

> **maxIterations**: `number`

Maximum Claude iterations per run. 0 means unlimited.

##### maxVerifyRetries

> **maxVerifyRetries**: `number`

Maximum verification retry attempts before marking issue as verify_exhausted.

##### openaiApiKey

> **openaiApiKey**: `string`

OpenAI API key for the OpenAI audit provider.

##### planDir

> **planDir**: `string`

Directory where plan files are written by the plan mode.

##### planModel

> **planModel**: `string`

Model used for plan mode iterations.

##### promptDir

> **promptDir**: `string`

Directory for custom prompt templates. Empty string uses built-in prompts.

##### pushStrategy

> **pushStrategy**: `"iteration"` \| `"on_complete"` \| `"manual"`

When to push commits: after each iteration, on completion, or manually.

##### splitModel

> **splitModel**: `string`

Model used for split mode iterations (after overflow).

##### streamLogDir

> **streamLogDir**: `string`

Directory for raw JSONL stream logs. Empty string disables logging.

##### testCommand

> **testCommand**: `string`

Shell command to run as the test gate during pre-completion checks. Empty string to skip.

##### triageModel

> **triageModel**: `string`

Model used for triage one-shot calls.

***

### ConfigSchema

> `const` **ConfigSchema**: `ZodObject`\<[`Config`](#config)\>

Defined in: src/types/schema/config-schema.ts:34

Runtime configuration for a barf project.

Loaded from `.barfrc` (KEY=VALUE format) via `loadConfig`. Falls back to
these defaults when the file is absent or a key is missing.

Configuration groups:
- **Paths**: `issuesDir`, `planDir`, `barfDir`, `promptDir`, `streamLogDir`
- **Orchestration**: `contextUsagePercent`, `maxAutoSplits`, `maxIterations`, `claudeTimeout`, `maxVerifyRetries`
- **Models**: `planModel`, `buildModel`, `splitModel`, `extendedContextModel`, `triageModel`
- **Audit**: `auditProvider`, `auditModel`, `openaiApiKey`, `geminiApiKey`, `anthropicApiKey`
- **Testing**: `testCommand`, `fixCommands`
- **Git**: `pushStrategy`
- **Provider**: `issueProvider`, `githubRepo`
- **Logging**: `logFile`, `logLevel`, `logPretty`
