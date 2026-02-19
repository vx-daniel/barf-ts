[**barf**](../../../../README.md)

***

[barf](../../../../README.md) / [core/issue/factory](../README.md) / createIssueProvider

# Function: createIssueProvider()

> **createIssueProvider**(`config`): `Result`\<[`IssueProvider`](../../base/classes/IssueProvider.md), [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/factory.ts:15

Instantiates the issue provider selected in `config.issueProvider`.

## Parameters

### config

Loaded barf configuration; `issueProvider` and `githubRepo` are read here.

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

`Result`\<[`IssueProvider`](../../base/classes/IssueProvider.md), [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(IssueProvider)` on success, `err(Error)` if `issueProvider` is `'github'`
  and `githubRepo` is not set.
