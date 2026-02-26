[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

Main orchestration loop — the heart of barf's issue processing.

The loop runs Claude iterations on an issue until it reaches a terminal
state (COMPLETED/VERIFIED) or the iteration limit is exhausted. Each
iteration's outcome is dispatched to a specific handler in `outcomes.ts`.

The loop manages:
- Issue locking (acquired at start, released in `finally`)
- Model selection (plan vs build, with overflow escalation)
- Prompt template resolution and variable injection
- Session stats persistence (best-effort, in `finally`)

## Orchestration

### RunLoopDeps

> **RunLoopDeps** = `object`

Defined in: src/core/batch/loop.ts:48

Injectable dependencies for [runLoop](#runloop). Pass mocks in tests.

All fields are optional — when omitted, the real implementations are used.
This enables isolated unit testing of the orchestration loop without
spawning Claude processes or writing to the filesystem.

#### Properties

##### runClaudeIteration?

> `optional` **runClaudeIteration**: *typeof* [`runClaudeIteration`](Orchestration-8.md#runclaudeiteration)

Defined in: src/core/batch/loop.ts:50

Override the Claude iteration runner (for testing).

##### runPreComplete?

> `optional` **runPreComplete**: *typeof* [`runPreComplete`](Verification.md#runprecomplete)

Defined in: src/core/batch/loop.ts:54

Override the pre-completion gate (for testing).

##### verifyIssue?

> `optional` **verifyIssue**: *typeof* [`verifyIssue`](Verification-4.md#verifyissue)

Defined in: src/core/batch/loop.ts:52

Override the verification runner (for testing).

***

### runLoop()

> **runLoop**(`issueId`, `mode`, `config`, `provider`, `deps?`): [`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/batch/loop.ts:281

Core orchestration loop. Runs Claude iterations until the issue reaches a
terminal state or `config.maxIterations` is exhausted.

No globals — all state passed as arguments. The loop handles:
- State transitions (IN_PROGRESS on start, PLANNED/COMPLETED/SPLIT on exit)
- Context overflow decisions (split vs escalate to larger model)
- Plan file detection (plan mode exits after one iteration)
- Acceptance criteria checking and pre-completion gate (build mode)
- Post-COMPLETED verification
- Session stats persistence (best-effort)
- Issue locking/unlocking (POSIX file locks)

#### Parameters

##### issueId

`string`

ID of the issue to process.

##### mode

`'plan'` runs one iteration then checks for a plan file; `'build'` loops until COMPLETED.

`"plan"` | `"build"` | `"split"`

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

##### provider

[`IssueProvider`](Issue-Model.md#abstract-issueprovider)

Issue provider used to lock, read, and write the issue.

##### deps?

[`RunLoopDeps`](#runloopdeps) = `{}`

Injectable dependencies; pass `{ runClaudeIteration: mockFn }` in tests.

#### Returns

[`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` when the loop exits cleanly, `err(Error)` if locking or a Claude iteration fails.
