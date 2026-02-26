[**barf**](README.md)

***

[barf](modules.md) / Triage

# Triage

Triage orchestration — one-shot Claude evaluation of NEW issues.

Evaluates whether a NEW issue needs further refinement (interview) before
planning can proceed. Uses a one-shot Claude call with the triage prompt
template. The result is either `needs_interview=false` (ready for planning)
or `needs_interview=true` with appended interview questions.

## Triage

### ExecFn()

> **ExecFn** = (`file`, `args?`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](types/schema/exec-schema.md#execresult)\>

Defined in: src/core/triage/triage.ts:29

Injectable subprocess function — mirrors [execFileNoThrow](Utilities.md#execfilenothrow)'s signature.
Pass a mock in tests to avoid spawning a real Claude process.

#### Parameters

##### file

`string`

##### args?

`string`[]

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](types/schema/exec-schema.md#execresult)\>

***

### triageIssue()

> **triageIssue**(`issueId`, `config`, `provider`, `execFn?`, `displayContext?`): [`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/triage/triage.ts:58

Evaluates a single NEW issue with a one-shot Claude call to determine whether
it needs further refinement before planning can proceed.

Skips issues where `needs_interview` is already set (already triaged).
On completion, sets `needs_interview=false` or `needs_interview=true` and
appends a `## Interview Questions` section to the issue body when questions exist.

#### Parameters

##### issueId

`string`

ID of the issue to triage.

##### config

Loaded barf configuration (triageModel, dirs, etc.).

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

##### provider

[`IssueProvider`](Issue-Model.md#abstract-issueprovider)

Issue provider for reading and writing the issue.

##### execFn?

[`ExecFn`](#execfn) = `execFileNoThrow`

Subprocess runner; defaults to [execFileNoThrow](Utilities.md#execfilenothrow). Injectable for tests.

##### displayContext?

When set, a sticky header line is shown on TTY stderr during the triage call.

###### issueId

`string` = `...`

Issue ID being processed.

###### mode

`string` = `...`

Command or loop mode being executed (e.g. `'plan'`, `'build'`, `'triage'`).

###### state

`string` = `...`

Current issue state at the time of the call.

###### title

`string` = `...`

Issue title (truncated to 50 chars before display).

#### Returns

[`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` on success or skip, `err(Error)` on I/O or Claude failure.
