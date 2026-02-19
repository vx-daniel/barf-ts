[**barf**](../../../../README.md)

***

[barf](../../../../README.md) / [cli/commands/auto](../README.md) / autoCommand

# Function: autoCommand()

> **autoCommand**(`provider`, `opts`, `config`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/cli/commands/auto.ts:27

Continuously orchestrates plan → build until no actionable issues remain.

Each iteration:
1. Plans all `PLAN_STATES` issues sequentially (order preserved).
2. Builds up to `opts.batch` `BUILD_STATES` issues concurrently.

The loop exits when both queues are empty or the provider returns an error.
`opts.max` is unused — iteration count defaults to `config.maxIterations`.

## Parameters

### provider

[`IssueProvider`](../../../../core/issue/base/classes/IssueProvider.md)

Issue provider supplying and persisting issues.

### opts

`batch`: max concurrent builds; `max`: reserved, currently unused.

#### batch

`number`

#### max

`number`

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

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
