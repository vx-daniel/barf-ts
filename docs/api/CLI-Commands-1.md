[**barf**](README.md)

***

[barf](modules.md) / CLI Commands

# CLI Commands

## Type Aliases

### AutoDeps

> **AutoDeps** = `object`

Defined in: src/cli/commands/auto.ts:15

Injectable dependencies for [autoCommand](#autocommand).
Pass mocks in tests to avoid spawning real Claude processes.

#### Properties

##### runClaudeIteration?

> `optional` **runClaudeIteration**: [`RunLoopDeps`](Orchestration-2.md#runloopdeps)\[`"runClaudeIteration"`\]

Defined in: src/cli/commands/auto.ts:17

##### triageIssue?

> `optional` **triageIssue**: *typeof* [`triageIssue`](Triage-2.md#triageissue)

Defined in: src/cli/commands/auto.ts:16

##### verifyIssue?

> `optional` **verifyIssue**: *typeof* [`verifyIssue`](Verification-4.md#verifyissue)

Defined in: src/cli/commands/auto.ts:18

## Functions

### autoCommand()

> **autoCommand**(`provider`, `opts`, `config`, `deps?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/cli/commands/auto.ts:43

Continuously orchestrates triage → plan → build until no actionable issues remain.

Each iteration:
1. Triages all `NEW` issues where `needs_interview` is undefined (single Claude call per issue).
2. Warns about any `NEW` issues with `needs_interview=true` — these need `/barf-interview` first.
3. Warns about any issues in legacy `INTERVIEWING` state (pre-migration data).
4. Plans all `NEW` issues where `needs_interview` is `false` (or `undefined` for backward compat).
5. Builds up to `opts.batch` `BUILD_STATES` issues concurrently.

The loop exits when all queues are empty or the provider returns an error.
`opts.max` is unused — iteration count defaults to `config.maxIterations`.

#### Parameters

##### provider

[`IssueProvider`](Issue-Model.md#abstract-issueprovider)

Issue provider supplying and persisting issues.

##### opts

`batch`: max concurrent builds; `max`: reserved, currently unused.

###### batch

`number`

###### max

`number`

##### config

Loaded barf configuration.

###### anthropicApiKey

`string` = `...`

Anthropic API key for the Claude audit provider.

###### auditModel

`string` = `...`

Model used for audit provider calls.

###### auditProvider

`"openai"` \| `"gemini"` \| `"claude"` \| `"codex"` = `...`

Which audit provider to use for code review.

###### barfDir

`string` = `...`

Directory for barf internal state (lock files, etc.).

###### buildModel

`string` = `...`

Model used for build mode iterations.

###### claudeAuditModel

`string` = `...`

Model used by the Claude audit provider.

###### claudeTimeout

`number` = `...`

Timeout in seconds for each Claude iteration.

###### contextUsagePercent

`number` = `...`

Percentage of context window to use before triggering overflow (split/escalate).

###### extendedContextModel

`string` = `...`

Model used when escalating past maxAutoSplits (larger context window).

###### fixCommands

`string`[] = `...`

Shell commands to run as fix steps before the test gate (best-effort, failures don't block).

###### geminiApiKey

`string` = `...`

Google Gemini API key for the Gemini audit provider.

###### geminiModel

`string` = `...`

Gemini model identifier for the Gemini audit provider.

###### githubRepo

`string` = `...`

GitHub repository slug (owner/repo) for the GitHub issue provider.

###### issueProvider

`"local"` \| `"github"` = `...`

Issue storage backend: local filesystem or GitHub Issues.

###### issuesDir

`string` = `...`

Directory where issue markdown files are stored. Relative to project root.

###### logFile

`string` = `...`

Path to the pino log file.

###### logLevel

`string` = `...`

Pino log level (trace, debug, info, warn, error, fatal).

###### logPretty

`boolean` = `...`

Enable pretty-printed log output (for development).

###### maxAutoSplits

`number` = `...`

Maximum number of automatic splits before escalating to extended context model.

###### maxIterations

`number` = `...`

Maximum Claude iterations per run. 0 means unlimited.

###### maxVerifyRetries

`number` = `...`

Maximum verification retry attempts before marking issue as verify_exhausted.

###### openaiApiKey

`string` = `...`

OpenAI API key for the OpenAI audit provider.

###### planDir

`string` = `...`

Directory where plan files are written by the plan mode.

###### planModel

`string` = `...`

Model used for plan mode iterations.

###### promptDir

`string` = `...`

Directory for custom prompt templates. Empty string uses built-in prompts.

###### pushStrategy

`"iteration"` \| `"on_complete"` \| `"manual"` = `...`

When to push commits: after each iteration, on completion, or manually.

###### splitModel

`string` = `...`

Model used for split mode iterations (after overflow).

###### streamLogDir

`string` = `...`

Directory for raw JSONL stream logs. Empty string disables logging.

###### testCommand

`string` = `...`

Shell command to run as the test gate during pre-completion checks. Empty string to skip.

###### triageModel

`string` = `...`

Model used for triage one-shot calls.

##### deps?

[`AutoDeps`](#autodeps) = `{}`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
