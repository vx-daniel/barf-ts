[**barf**](README.md)

***

[barf](modules.md) / Issue Model

# Issue Model

## Issue Model

### VALID\_TRANSITIONS

> `const` **VALID\_TRANSITIONS**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<[`IssueState`](issue-schema.md#issuestate-1), [`IssueState`](issue-schema.md#issuestate-1)[]\>

Defined in: src/core/issue/index.ts:20

The allowed state transitions in the barf issue lifecycle.

Used by [validateTransition](#validatetransition) to reject illegal moves.
Terminal states (`SPLIT`, `VERIFIED`) have empty arrays — no further transitions allowed.
`COMPLETED` is an intermediate state; only `VERIFIED` is the true terminal after verification.

***

### parseAcceptanceCriteria()

> **parseAcceptanceCriteria**(`content`): `boolean`

Defined in: src/core/issue/index.ts:177

Returns `true` if all acceptance criteria checkboxes are checked.

Scans the `## Acceptance Criteria` section for `- [ ]` unchecked items.
Returns `true` when none are found, or when the section is absent entirely.

#### Parameters

##### content

`string`

Raw issue body (the markdown text after the frontmatter `---`).

#### Returns

`boolean`

***

### parseIssue()

> **parseIssue**(`content`): `Result`\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error) \| `ZodError`\<`unknown`\>\>

Defined in: src/core/issue/index.ts:50

Parses a frontmatter markdown string into a validated [Issue](issue-schema.md#issue).

Expected format:
```
---
id=001
title=My issue
state=NEW
parent=
children=
split_count=0
---

Issue body text here.
```

#### Parameters

##### content

`string`

#### Returns

`Result`\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error) \| `ZodError`\<`unknown`\>\>

`ok(Issue)` on success, `err(ZodError | Error)` if format is invalid.

***

### serializeIssue()

> **serializeIssue**(`issue`): `string`

Defined in: src/core/issue/index.ts:118

Serializes an [Issue](issue-schema.md#issue) to frontmatter markdown.
Round-trips cleanly with [parseIssue](#parseissue).

#### Parameters

##### issue

###### body

`string` = `...`

###### children

`string`[] = `...`

###### context_usage_percent?

`number` = `...`

###### force_split

`boolean` = `...`

###### id

`string` = `...`

###### is_verify_fix?

`boolean` = `...`

When `true`, this issue was created by `verifyIssue` to fix a parent's failures — skip re-verifying it.

###### needs_interview?

`boolean` = `...`

Triage result set by `triageIssue`.
- `undefined` — not yet triaged
- `false` — triaged, no refinement needed (or interview complete)
- `true` — triaged, needs `/barf-interview` before planning

###### parent

`string` = `...`

###### run_count

`number` = `...`

Number of runs/sessions executed on this issue.

###### split_count

`number` = `...`

###### state

`"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"` = `IssueStateSchema`

###### title

`string` = `...`

###### total_duration_seconds

`number` = `...`

Cumulative wall-clock duration in seconds across all runs.

###### total_input_tokens

`number` = `...`

Cumulative input tokens (base + cache) across all runs.

###### total_iterations

`number` = `...`

Total iterations across all runs.

###### total_output_tokens

`number` = `...`

Cumulative output tokens across all runs.

###### verify_count

`number` = `...`

Number of times verification has been attempted on this issue. Incremented on each failure.

###### verify_exhausted?

`boolean` = `...`

When `true`, `verify_count` exceeded `maxVerifyRetries`; issue is left as COMPLETED without VERIFIED.

#### Returns

`string`

***

### validateTransition()

> **validateTransition**(`from`, `to`): `Result`\<`void`, [`InvalidTransitionError`](Configuration-1.md#invalidtransitionerror)\>

Defined in: src/core/issue/index.ts:158

Validates a proposed state transition against [VALID\_TRANSITIONS](#valid_transitions).

#### Parameters

##### from

Current state of the issue

`"NEW"` | `"PLANNED"` | `"IN_PROGRESS"` | `"STUCK"` | `"SPLIT"` | `"COMPLETED"` | `"VERIFIED"`

##### to

Desired next state to transition to

`"NEW"` | `"PLANNED"` | `"IN_PROGRESS"` | `"STUCK"` | `"SPLIT"` | `"COMPLETED"` | `"VERIFIED"`

#### Returns

`Result`\<`void`, [`InvalidTransitionError`](Configuration-1.md#invalidtransitionerror)\>

`ok(undefined)` if the transition is permitted,
  `err(InvalidTransitionError)` if it is not.
