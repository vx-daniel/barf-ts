[**barf**](../../README.md)

***

[barf](../../modules.md) / types/schema/batch-schema

# types/schema/batch-schema

## Orchestration

### OverflowDecisionSchema

> `const` **OverflowDecisionSchema**: `ZodObject`\<[`OverflowDecision`](#overflowdecision)\>

Defined in: src/types/schema/batch-schema.ts:10

The decision taken by `handleOverflow` when Claude's context fills up.
- `split`: decompose the issue into sub-issues using `splitModel`
- `escalate`: retry with `extendedContextModel` (larger context window)

## Other

### OverflowDecision

> **OverflowDecision** = `object`

Defined in: src/types/schema/batch-schema.ts:15

A validated overflow decision. Derived from [OverflowDecisionSchema](#overflowdecisionschema).

#### Type Declaration

##### action

> **action**: `"split"` \| `"escalate"`

##### nextModel

> **nextModel**: `string`
