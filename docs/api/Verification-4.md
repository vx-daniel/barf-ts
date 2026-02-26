[**barf**](README.md)

***

[barf](modules.md) / Verification

# Verification

Verification orchestration — post-COMPLETED verification workflow.

After an issue reaches COMPLETED, this module orchestrates the verification
flow: run checks, and based on the outcome either transition to VERIFIED,
create a fix sub-issue, or mark the issue as verify-exhausted.

## Verification

### verifyIssue()

> **verifyIssue**(`issueId`, `config`, `provider`, `deps?`): [`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/verification/orchestration.ts:42

Runs verification for an issue after it reaches COMPLETED.

The verification workflow has three possible outcomes:

1. **All checks pass** → transition to VERIFIED (terminal state)
2. **Checks fail, retries remaining** → create a fix sub-issue with failure
   details, increment `verify_count` on the parent
3. **Checks fail, retries exhausted** → set `verify_exhausted=true`, leave
   as COMPLETED (no further automatic attempts)

Issues with `is_verify_fix=true` are skipped to prevent recursive verification
of issues that were themselves created to fix parent verification failures.

#### Parameters

##### issueId

`string`

ID of the COMPLETED issue to verify.

##### config

Loaded barf configuration (`maxVerifyRetries` controls retry cap).

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

Issue provider for reading, writing, and transitioning issues.

##### deps?

Injectable dependencies; pass `{ execFn: mockFn }` in tests.

###### execFn?

[`ExecFn`](Verification-1.md#execfn)

#### Returns

[`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` always; side effects are written to the provider.
