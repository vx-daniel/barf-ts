[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/issue](../README.md) / parseIssue

# Function: parseIssue()

> **parseIssue**(`content`): `Result`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error) \| `ZodError`\<`unknown`\>\>

Defined in: src/core/issue/index.ts:42

Parses a frontmatter markdown string into a validated [Issue](../../../types/type-aliases/Issue.md).

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

## Parameters

### content

`string`

## Returns

`Result`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error) \| `ZodError`\<`unknown`\>\>

`ok(Issue)` on success, `err(ZodError | Error)` if format is invalid.
