[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/issue](../README.md) / parseAcceptanceCriteria

# Function: parseAcceptanceCriteria()

> **parseAcceptanceCriteria**(`content`): `boolean`

Defined in: src/core/issue/index.ts:113

Returns `true` if all acceptance criteria checkboxes are checked.

Scans the `## Acceptance Criteria` section for `- [ ]` unchecked items.
Returns `true` when none are found, or when the section is absent entirely.

## Parameters

### content

`string`

Raw issue body (the markdown text after the frontmatter `---`).

## Returns

`boolean`
