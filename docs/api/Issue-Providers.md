[**barf**](README.md)

***

[barf](modules.md) / Issue Providers

# Issue Providers

GitHub label mapping — bidirectional conversion between barf states and GitHub labels.

The GitHub issue provider uses labels prefixed with `barf:` to represent
barf issue states. This module provides the mapping tables and conversion
functions used by GitHubIssueProvider.

## Issue Providers

### GHIssue

> **GHIssue** = `object`

Defined in: src/core/issue/providers/github-labels.ts:73

Parsed GitHub issue. Derived from [GHIssueSchema](#ghissueschema).

#### Type Declaration

##### body

> **body**: `string`

##### labels

> **labels**: `object`[]

##### milestone

> **milestone**: \{ `number`: `number`; `title`: `string`; \} \| `null`

##### number

> **number**: `number`

##### state

> **state**: `"open"` \| `"closed"`

##### title

> **title**: `string`

***

### GHIssueSchema

> `const` **GHIssueSchema**: `ZodObject`\<[`GHIssue`](#ghissue)\>

Defined in: src/core/issue/providers/github-labels.ts:56

Zod schema for a GitHub issue API response.

Validates the subset of fields barf cares about: number, title, body,
open/closed state, labels, and optional milestone. The `body` field
uses a nullable transform since GitHub returns `null` for empty bodies.

***

### LABEL\_TO\_STATE

> `const` **LABEL\_TO\_STATE**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, [`IssueState`](issue-schema.md#issuestate-1)\>

Defined in: src/core/issue/providers/github-labels.ts:40

Reverse mapping: GitHub label names to barf issue states.

Derived from [STATE\_TO\_LABEL](#state_to_label) by swapping keys and values.
Used when parsing GitHub issue responses to determine the barf state.

***

### STATE\_TO\_LABEL

> `const` **STATE\_TO\_LABEL**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<[`IssueState`](issue-schema.md#issuestate-1), `string`\>

Defined in: src/core/issue/providers/github-labels.ts:22

Maps barf issue states to their corresponding GitHub label names.

Every state in the IssueStateSchema has a corresponding label.
Labels use the `barf:` prefix followed by a lowercase hyphenated version
of the state name.

***

### ghToIssue()

> **ghToIssue**(`gh`): `object`

Defined in: src/core/issue/providers/github-labels.ts:90

Converts a GitHub issue API response into a barf [Issue](issue-schema.md#issue).

Determines the barf state by checking:
1. If the issue is closed → `COMPLETED`
2. If a `barf:*` state label exists → corresponding state
3. Otherwise → `NEW`

Fields not tracked by GitHub (split_count, verify_count, tokens, etc.)
are initialized to their default zero values.

#### Parameters

##### gh

Parsed GitHub issue from the API.

###### body

`string` = `...`

###### labels

`object`[] = `...`

###### milestone

\{ `number`: `number`; `title`: `string`; \} \| `null` = `...`

###### number

`number` = `...`

###### state

`"open"` \| `"closed"` = `...`

###### title

`string` = `...`

#### Returns

A barf issue with state derived from GitHub labels.

##### body

> **body**: `string`

##### children

> **children**: `string`[]

##### context\_usage\_percent?

> `optional` **context\_usage\_percent**: `number`

##### force\_split

> **force\_split**: `boolean`

##### id

> **id**: `string`

##### is\_verify\_fix?

> `optional` **is\_verify\_fix**: `boolean`

When `true`, this issue was created by `verifyIssue` to fix a parent's failures — skip re-verifying it.

##### needs\_interview?

> `optional` **needs\_interview**: `boolean`

Triage result set by `triageIssue`.
- `undefined` — not yet triaged
- `false` — triaged, no refinement needed (or interview complete)
- `true` — triaged, needs `/barf-interview` before planning

##### parent

> **parent**: `string`

##### run\_count

> **run\_count**: `number`

Number of runs/sessions executed on this issue.

##### split\_count

> **split\_count**: `number`

##### state

> **state**: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"` = `IssueStateSchema`

##### title

> **title**: `string`

##### total\_duration\_seconds

> **total\_duration\_seconds**: `number`

Cumulative wall-clock duration in seconds across all runs.

##### total\_input\_tokens

> **total\_input\_tokens**: `number`

Cumulative input tokens (base + cache) across all runs.

##### total\_iterations

> **total\_iterations**: `number`

Total iterations across all runs.

##### total\_output\_tokens

> **total\_output\_tokens**: `number`

Cumulative output tokens across all runs.

##### verify\_count

> **verify\_count**: `number`

Number of times verification has been attempted on this issue. Incremented on each failure.

##### verify\_exhausted?

> `optional` **verify\_exhausted**: `boolean`

When `true`, `verify_count` exceeded `maxVerifyRetries`; issue is left as COMPLETED without VERIFIED.
