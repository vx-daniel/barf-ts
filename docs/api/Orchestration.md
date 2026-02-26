[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

Batch orchestration helpers — pure utility functions used by the main loop.

These are stateless, side-effect-free functions that support the orchestration
loop without managing any I/O or state transitions themselves.

## Orchestration

### handleOverflow()

> **handleOverflow**(`splitCount`, `config`): `object`

Defined in: src/core/batch/helpers.ts:47

Pure decision: given the current split count, decide whether to split or escalate.

When a Claude session hits the context window limit (overflow), barf must decide:
- **Split** (`split_count < maxAutoSplits`): break the issue into smaller sub-issues
- **Escalate** (`split_count >= maxAutoSplits`): switch to a larger context model

#### Parameters

##### splitCount

`number`

How many times this issue has already been split.

##### config

Barf configuration containing `maxAutoSplits`, `splitModel`, `extendedContextModel`.

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

#### Returns

`object`

An [OverflowDecision](types/schema/batch-schema.md#overflowdecision) with the chosen action and next model to use.

##### action

> **action**: `"split"` \| `"escalate"`

##### nextModel

> **nextModel**: `string`

***

### planSplitChildren()

> **planSplitChildren**(`childIds`, `config`, `provider`, `runLoop`, `deps`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/core/batch/helpers.ts:96

Plans each NEW child issue sequentially after a split operation.

After a split, the parent issue's children need to be planned before they
can be built. This function iterates through child IDs, fetches each one,
and runs the plan loop for any that are still in `NEW` state.

Failures are logged but do not propagate — a single child planning failure
should not prevent the remaining children from being planned.

No global state mutations — all state passed as arguments.

#### Parameters

##### childIds

`string`[]

IDs of child issues to plan.

##### config

Barf configuration.

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

Issue provider for fetching and writing issues.

##### runLoop

(...`args`) => `any`

The runLoop function (passed to avoid circular imports).

##### deps

[`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `unknown`\>

Injectable dependencies forwarded to runLoop.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### resolveIssueFile()

> **resolveIssueFile**(`issueId`, `config`): `string`

Defined in: src/core/batch/helpers.ts:69

Resolves the local file path for an issue, used for prompt template injection.

For the local filesystem provider, issues are stored as `{issuesDir}/{id}.md`.
For the GitHub provider, there is no local file — the issue ID is returned
as a fallback so the prompt template receives a meaningful identifier.

#### Parameters

##### issueId

`string`

Issue identifier to resolve.

##### config

Barf configuration containing `issuesDir`.

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

#### Returns

`string`

Absolute path to the issue markdown file, or the issue ID if no file exists.

***

### shouldContinue()

> **shouldContinue**(`iteration`, `config`): `boolean`

Defined in: src/core/batch/helpers.ts:31

Pure decision: should the loop run another iteration?

Returns `true` when `maxIterations` is 0 (unlimited) or when the current
iteration count hasn't reached the limit yet. This centralizes the
continuation logic so the main loop doesn't embed magic comparisons.

#### Parameters

##### iteration

`number`

Zero-based current iteration count.

##### config

Barf configuration containing `maxIterations`.

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

#### Returns

`boolean`

`true` if the loop should continue, `false` to stop.
