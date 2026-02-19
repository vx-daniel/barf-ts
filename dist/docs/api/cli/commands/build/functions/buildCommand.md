[**barf**](../../../../README.md)

***

[barf](../../../../README.md) / [cli/commands/build](../README.md) / buildCommand

# Function: buildCommand()

> **buildCommand**(`provider`, `opts`, `config`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/cli/commands/build.ts:21

Builds one or more issues (PLANNED/IN_PROGRESS → COMPLETED) using Claude AI.

**Single-issue mode (`opts.issue` set):** Builds the named issue and returns.

**Batch mode (`opts.issue` omitted):** Lists all issues, filters to `BUILDABLE`
states, picks up to `opts.batch`, and runs them concurrently via
`Promise.allSettled`. Exits with code 1 if any build fails.

## Parameters

### provider

[`IssueProvider`](../../../../core/issue/base/classes/IssueProvider.md)

Issue provider supplying and persisting issues.

### opts

`issue`: explicit issue ID; `batch`: concurrency limit; `max`: iteration cap (0 = use `config`).

#### batch

`number`

#### issue?

`string`

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
