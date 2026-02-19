[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/batch](../README.md) / handleOverflow

# Function: handleOverflow()

> **handleOverflow**(`splitCount`, `config`): [`OverflowDecision`](../interfaces/OverflowDecision.md)

Defined in: src/core/batch.ts:59

Pure: given current split count, decide split vs. escalate.
split_count < maxAutoSplits  → split (use splitModel)
split_count >= maxAutoSplits → escalate (use extendedContextModel)

## Parameters

### splitCount

`number`

### config

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

[`OverflowDecision`](../interfaces/OverflowDecision.md)
