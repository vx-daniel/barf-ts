[**barf**](../../README.md)

***

[barf](../../README.md) / [types](../README.md) / IssueSchema

# Variable: IssueSchema

> `const` **IssueSchema**: `ZodObject`\<[`Issue`](../type-aliases/Issue.md)\>

Defined in: src/types/index.ts:45

A barf work item. Stored as frontmatter markdown under `issuesDir`.

The `body` field contains everything after the closing `---` delimiter.
`children` holds IDs of sub-issues created by a split operation.
`split_count` tracks how many times this issue has been split (used for overflow decisions).
