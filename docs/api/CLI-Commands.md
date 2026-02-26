[**barf**](README.md)

***

[barf](modules.md) / CLI Commands

# CLI Commands

## Type Aliases

### AuditDeps

> **AuditDeps** = `object`

Defined in: src/cli/commands/audit.ts:25

Injectable dependencies for [auditCommand](#auditcommand).
Pass mocks in tests to control the audit provider and subprocess calls.

#### Properties

##### execFn?

> `optional` **execFn**: *typeof* [`execFileNoThrow`](Utilities.md#execfilenothrow)

Defined in: src/cli/commands/audit.ts:26

##### provider?

> `optional` **provider**: [`AuditProvider`](Audit-Providers.md#abstract-auditprovider)

Defined in: src/cli/commands/audit.ts:27

## Functions

### auditCommand()

> **auditCommand**(`provider`, `opts`, `config`, `deps?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/cli/commands/audit.ts:265

Audits one or all COMPLETED issues.

Default behaviour (`--all` or no flags): audits all COMPLETED issues.
`--issue <id>`: audits only the named issue.

#### Parameters

##### provider

[`IssueProvider`](Issue-Model.md#abstract-issueprovider)

Issue provider for listing and reading issues.

##### opts

`issue`: explicit issue ID; `all`: audit all COMPLETED issues.

###### all

`boolean`

###### issue?

`string`

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

[`AuditDeps`](#auditdeps) = `{}`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
