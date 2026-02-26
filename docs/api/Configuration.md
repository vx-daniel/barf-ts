[**barf**](README.md)

***

[barf](modules.md) / Configuration

# Configuration

## Configuration

### loadConfig()

> **loadConfig**(`rcPath?`): `object`

Defined in: src/core/config.ts:139

Loads barf configuration from a `.barfrc` file.

Falls back to schema defaults if the file is missing or cannot be parsed.
Never throws — invalid config is silently replaced with defaults.

#### Parameters

##### rcPath?

`string`

Path to the `.barfrc` file. Defaults to `<cwd>/.barfrc`.

#### Returns

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

### parseBarfrc()

> **parseBarfrc**(`content`): `Result`\<\{ `anthropicApiKey`: `string`; `auditModel`: `string`; `auditProvider`: `"openai"` \| `"gemini"` \| `"claude"` \| `"codex"`; `barfDir`: `string`; `buildModel`: `string`; `claudeAuditModel`: `string`; `claudeTimeout`: `number`; `contextUsagePercent`: `number`; `extendedContextModel`: `string`; `fixCommands`: `string`[]; `geminiApiKey`: `string`; `geminiModel`: `string`; `githubRepo`: `string`; `issueProvider`: `"local"` \| `"github"`; `issuesDir`: `string`; `logFile`: `string`; `logLevel`: `string`; `logPretty`: `boolean`; `maxAutoSplits`: `number`; `maxIterations`: `number`; `maxVerifyRetries`: `number`; `openaiApiKey`: `string`; `planDir`: `string`; `planModel`: `string`; `promptDir`: `string`; `pushStrategy`: `"iteration"` \| `"on_complete"` \| `"manual"`; `splitModel`: `string`; `streamLogDir`: `string`; `testCommand`: `string`; `triageModel`: `string`; \}, `ZodError`\<`unknown`\>\>

Defined in: src/core/config.ts:74

Parses a `.barfrc` KEY=VALUE string into a validated [Config](config-schema.md#config).

Only recognises keys listed in the internal KEY_MAP; unknown keys are silently ignored.

#### Parameters

##### content

`string`

Raw `.barfrc` file contents.

#### Returns

`Result`\<\{ `anthropicApiKey`: `string`; `auditModel`: `string`; `auditProvider`: `"openai"` \| `"gemini"` \| `"claude"` \| `"codex"`; `barfDir`: `string`; `buildModel`: `string`; `claudeAuditModel`: `string`; `claudeTimeout`: `number`; `contextUsagePercent`: `number`; `extendedContextModel`: `string`; `fixCommands`: `string`[]; `geminiApiKey`: `string`; `geminiModel`: `string`; `githubRepo`: `string`; `issueProvider`: `"local"` \| `"github"`; `issuesDir`: `string`; `logFile`: `string`; `logLevel`: `string`; `logPretty`: `boolean`; `maxAutoSplits`: `number`; `maxIterations`: `number`; `maxVerifyRetries`: `number`; `openaiApiKey`: `string`; `planDir`: `string`; `planModel`: `string`; `promptDir`: `string`; `pushStrategy`: `"iteration"` \| `"on_complete"` \| `"manual"`; `splitModel`: `string`; `streamLogDir`: `string`; `testCommand`: `string`; `triageModel`: `string`; \}, `ZodError`\<`unknown`\>\>

`ok(Config)` on success, `err(ZodError)` if a required field fails validation.
