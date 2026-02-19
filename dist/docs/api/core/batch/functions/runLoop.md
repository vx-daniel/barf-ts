[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/batch](../README.md) / runLoop

# Function: runLoop()

> **runLoop**(`issueId`, `mode`, `config`, `provider`): `ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/batch.ts:120

Core orchestration loop. Runs Claude iterations until the issue reaches a
terminal state or `config.maxIterations` is exhausted.

No globals — all state passed as arguments. Handles state transitions,
context overflow (split/escalate), plan file detection, acceptance criteria,
and optional test validation.

## Parameters

### issueId

`string`

ID of the issue to process.

### mode

[`LoopMode`](../type-aliases/LoopMode.md)

`'plan'` runs one iteration then checks for a plan file; `'build'` loops until COMPLETED.

### config

Loaded barf configuration.

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

### provider

[`IssueProvider`](../../issue/base/classes/IssueProvider.md)

Issue provider used to lock, read, and write the issue.

## Returns

`ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` when the loop exits cleanly, `err(Error)` if locking or a Claude iteration fails.
