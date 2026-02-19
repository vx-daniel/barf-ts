[**barf**](../../../../README.md)

***

[barf](../../../../README.md) / [cli/commands/plan](../README.md) / planCommand

# Function: planCommand()

> **planCommand**(`provider`, `opts`, `config`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/cli/commands/plan.ts:19

Plans a single issue (NEW → PLANNED) using Claude AI.

When `opts.issue` is omitted, auto-selects the highest-priority NEW issue
via [IssueProvider.autoSelect](../../../../core/issue/base/classes/IssueProvider.md#autoselect). Exits with code 1 if auto-selection
or the planning loop fails.

## Parameters

### provider

[`IssueProvider`](../../../../core/issue/base/classes/IssueProvider.md)

Issue provider supplying and persisting issues.

### opts

`issue`: explicit issue ID to plan; omit to auto-select.

#### issue?

`string`

### config

Loaded barf configuration (model, context threshold, etc.).

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
