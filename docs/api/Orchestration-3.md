[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

Iteration outcome handlers — extracted decision branches from the main loop.

Each function handles one specific outcome from a Claude iteration:
split completion, overflow, plan completion, or build completion.
By extracting these into named functions, the main loop becomes a
clean dispatcher that's easy to read and test.

## Orchestration

### LoopState

> **LoopState** = `object`

Defined in: src/core/batch/outcomes.ts:34

Mutable loop state passed between the main loop and outcome handlers.

This object is mutated in place by outcome handlers to communicate
state changes back to the main loop (e.g. switching models after overflow,
toggling `splitPending` after an overflow decision).

#### Properties

##### iteration

> **iteration**: `number`

Defined in: src/core/batch/outcomes.ts:40

Zero-based iteration counter.

##### lastContextSize

> **lastContextSize**: `number`

Defined in: src/core/batch/outcomes.ts:46

Token count from the most recent iteration (for stats).

##### model

> **model**: `string`

Defined in: src/core/batch/outcomes.ts:38

Current model identifier (may change after overflow/escalation).

##### sessionStartTime

> **sessionStartTime**: `number`

Defined in: src/core/batch/outcomes.ts:48

Unix timestamp (ms) when the session started.

##### splitPending

> **splitPending**: `boolean`

Defined in: src/core/batch/outcomes.ts:36

Whether the next iteration should run in split mode.

##### totalInputTokens

> **totalInputTokens**: `number`

Defined in: src/core/batch/outcomes.ts:42

Cumulative input tokens across all iterations.

##### totalOutputTokens

> **totalOutputTokens**: `number`

Defined in: src/core/batch/outcomes.ts:44

Cumulative output tokens across all iterations.

***

### OutcomeDeps

> **OutcomeDeps** = `object`

Defined in: src/core/batch/outcomes.ts:59

Injectable dependencies for outcome handlers.

These mirror the `RunLoopDeps` type but are resolved (non-optional)
by the time they reach outcome handlers.

#### Properties

##### runPreComplete

> **runPreComplete**: *typeof* [`runPreComplete`](Verification.md#runprecomplete)

Defined in: src/core/batch/outcomes.ts:61

##### verifyIssue

> **verifyIssue**: *typeof* [`verifyIssue`](Verification-4.md#verifyissue)

Defined in: src/core/batch/outcomes.ts:60

***

### handleBuildCompletion()

> **handleBuildCompletion**(`issueId`, `config`, `provider`, `deps`, `iteration`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`"continue"` \| `"break"`\>

Defined in: src/core/batch/outcomes.ts:206

Handles build mode completion when acceptance criteria are met.

This handler runs the pre-completion gate (fix commands + test gate),
and if it passes, transitions the issue to COMPLETED and immediately
triggers verification.

#### Parameters

##### issueId

`string`

ID of the issue being built.

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

Issue provider for state transitions.

##### deps

[`OutcomeDeps`](#outcomedeps)

Injectable dependencies (verifyIssue, runPreComplete).

##### iteration

`number`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`"continue"` \| `"break"`\>

`'break'` if the issue was completed (caller should exit loop),
  `'continue'` if pre-complete failed and the loop should continue.

***

### handleOverflowOutcome()

> **handleOverflowOutcome**(`issueId`, `config`, `provider`, `state`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/core/batch/outcomes.ts:139

Handles a context overflow outcome from a Claude iteration.

When Claude's context window usage exceeds the configured threshold,
this handler decides whether to split the issue or escalate to a
larger context model. Mutates `state.splitPending` and `state.model`
to communicate the decision back to the main loop.

#### Parameters

##### issueId

`string`

ID of the issue that overflowed.

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

Issue provider for reading/writing split count.

##### state

[`LoopState`](#loopstate)

Mutable loop state (model and splitPending are updated).

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### handlePlanCompletion()

> **handlePlanCompletion**(`issueId`, `config`, `provider`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/core/batch/outcomes.ts:177

Handles plan mode completion after a single iteration.

In plan mode, Claude runs exactly one iteration. If a plan file exists
at `{planDir}/{issueId}.md` after the iteration, the issue is transitioned
to PLANNED state.

#### Parameters

##### issueId

`string`

ID of the issue being planned.

##### config

Barf configuration containing `planDir`.

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

Issue provider for state transitions.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

***

### handleSplitCompletion()

> **handleSplitCompletion**(`issueId`, `config`, `provider`, `state`, `planSplitChildren`, `runLoop`, `deps`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`"return"` \| `"break"`\>

Defined in: src/core/batch/outcomes.ts:85

Handles the completion of a split iteration.

After a split iteration completes, this handler:
1. Transitions the issue to SPLIT state
2. Persists session stats (before unlocking)
3. Unlocks the issue
4. Plans each NEW child issue sequentially

Returns `'return'` to signal the main loop should exit, or `'break'`
if no children were created (split produced no sub-issues).

#### Parameters

##### issueId

`string`

ID of the parent issue being split.

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

Issue provider for state transitions and I/O.

##### state

[`LoopState`](#loopstate)

Mutable loop state.

##### planSplitChildren

(...`args`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Function to plan child issues after split.

##### runLoop

`any`

##### deps

[`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `unknown`\>

Injectable dependencies forwarded to child planning.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`"return"` \| `"break"`\>

`'return'` if children were planned (caller should exit), `'break'` otherwise.
