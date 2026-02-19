[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/issue](../README.md) / serializeIssue

# Function: serializeIssue()

> **serializeIssue**(`issue`): `string`

Defined in: src/core/issue/index.ts:75

Serializes an [Issue](../../../types/type-aliases/Issue.md) to frontmatter markdown.
Round-trips cleanly with [parseIssue](parseIssue.md).

## Parameters

### issue

#### body

`string` = `...`

#### children

`string`[] = `...`

#### id

`string` = `...`

#### parent

`string` = `...`

#### split_count

`number` = `...`

#### state

`"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` = `IssueStateSchema`

#### title

`string` = `...`

## Returns

`string`
