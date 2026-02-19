[**barf**](../../../../README.md)

***

[barf](../../../../README.md) / [cli/commands/init](../README.md) / initCommand

# Function: initCommand()

> **initCommand**(`_provider`, `config`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/cli/commands/init.ts:34

Initialises barf in the current project directory.

**local provider:** Creates `issuesDir` and `planDir` directories.

**github provider:** Creates `barf:*` labels on the configured repo via the
`gh` CLI. Label creation is idempotent — `already_exists` responses are
silently ignored.

Writes a default `.barfrc` if one does not already exist.

## Parameters

### \_provider

[`IssueProvider`](../../../../core/issue/base/classes/IssueProvider.md)

Issue provider (unused; provider type is read from `config`).

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
