[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

Claude iteration runner — SDK query setup, timeout, and signal management.

This module creates and configures a Claude agent SDK query, sets up
the abort controller for timeouts, and delegates stream consumption
to `stream.ts`. It is the public-facing entry point for running a
single Claude iteration.

Key SDK options:
- `permissionMode: 'bypassPermissions'` — replaces `--dangerously-skip-permissions`
- `settingSources: []` — SDK isolation; no CLAUDE.md loaded, all context from prompt
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '100'` — disables auto-compact so barf controls context

## Claude Agent

### runClaudeIteration()

> **runClaudeIteration**(`prompt`, `model`, `config`, `issueId?`, `displayContext?`): [`ResultAsync`](#)\<\{ `outcome`: `"success"` \| `"error"` \| `"overflow"` \| `"rate_limited"`; `outputTokens`: `number`; `rateLimitResetsAt?`: `number`; `tokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/claude/iteration.ts:45

Runs a single Claude agent iteration via the `@anthropic-ai/claude-agent-sdk`.

No subprocess is spawned — the SDK manages the Claude Code process internally.
This function handles:
1. Computing the token threshold from config
2. Setting up the abort controller with timeout
3. Configuring stream logging (optional)
4. Creating the SDK query with isolated settings
5. Delegating stream consumption to [consumeSDKQuery](Orchestration-9.md#consumesdkquery)

#### Parameters

##### prompt

`string`

Full prompt text sent as the first user message.

##### model

`string`

Claude model identifier (e.g. `'claude-sonnet-4-6'`).

##### config

Loaded barf configuration (timeout, context percent, stream log dir).

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

##### issueId?

`string`

When set, each SDK message is appended to `config.streamLogDir/<issueId>.jsonl`.

##### displayContext?

When set, a sticky header line is shown above the progress line on TTY stderr.

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

[`ResultAsync`](#)\<\{ `outcome`: `"success"` \| `"error"` \| `"overflow"` \| `"rate_limited"`; `outputTokens`: `number`; `rateLimitResetsAt?`: `number`; `tokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(IterationResult)` on success/overflow/rate-limit, `err(Error)` if the SDK throws unexpectedly.
