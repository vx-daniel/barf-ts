[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/batch](../README.md) / OverflowDecision

# Interface: OverflowDecision

Defined in: src/core/batch.ts:38

The decision taken by `handleOverflow` when Claude's context fills up.
- `split`: decompose the issue into sub-issues using `splitModel`
- `escalate`: retry with `extendedContextModel` (larger context window)

## Properties

### action

> **action**: `"split"` \| `"escalate"`

Defined in: src/core/batch.ts:39

***

### nextModel

> **nextModel**: `string`

Defined in: src/core/batch.ts:40
