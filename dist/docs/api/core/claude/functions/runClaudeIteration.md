[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/claude](../README.md) / runClaudeIteration

# Function: runClaudeIteration()

> **runClaudeIteration**(`prompt`, `model`, `config`, `issueId?`): `ResultAsync`\<[`IterationResult`](../interfaces/IterationResult.md), [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/claude.ts:67

Spawns the `claude` CLI and runs a single agent iteration.
Prompt is passed via stdin. Never throws — all errors are captured in the result.

Key env override: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=100` disables Claude Code
auto-compact so barf can track context and interrupt at the configured threshold itself.

## Parameters

### prompt

`string`

Full prompt text; sent to the claude process via stdin.

### model

`string`

Claude model identifier (e.g. `'claude-sonnet-4-6'`).

### config

Loaded barf configuration (timeout, context percent, stream log dir).

#### barfDir

`string` = `...`

#### buildModel

`string` = `...`

#### claudeTimeout

`number` = `...`

#### contextUsagePercent

`number` = `...`

#### extendedContextModel

`string` = `...`

#### githubRepo

`string` = `...`

#### issueProvider

`"local"` \| `"github"` = `...`

#### issuesDir

`string` = `...`

#### maxAutoSplits

`number` = `...`

#### maxIterations

`number` = `...`

#### planDir

`string` = `...`

#### planModel

`string` = `...`

#### pushStrategy

`"manual"` \| `"iteration"` \| `"on_complete"` = `...`

#### splitModel

`string` = `...`

#### streamLogDir

`string` = `...`

#### testCommand

`string` = `...`

### issueId?

`string`

When set, stream output is appended to `config.streamLogDir/<issueId>.jsonl`.

## Returns

`ResultAsync`\<[`IterationResult`](../interfaces/IterationResult.md), [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(IterationResult)` on success, `err(Error)` if the process spawn fails unexpectedly.
