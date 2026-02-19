[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/issue](../README.md) / validateTransition

# Function: validateTransition()

> **validateTransition**(`from`, `to`): `Result`\<`void`, [`InvalidTransitionError`](../../../types/classes/InvalidTransitionError.md)\>

Defined in: src/core/issue/index.ts:94

Validates a proposed state transition against [VALID\_TRANSITIONS](../variables/VALID_TRANSITIONS.md).

## Parameters

### from

`"NEW"` | `"PLANNED"` | `"IN_PROGRESS"` | `"STUCK"` | `"SPLIT"` | `"COMPLETED"`

### to

`"NEW"` | `"PLANNED"` | `"IN_PROGRESS"` | `"STUCK"` | `"SPLIT"` | `"COMPLETED"`

## Returns

`Result`\<`void`, [`InvalidTransitionError`](../../../types/classes/InvalidTransitionError.md)\>

`ok(undefined)` if the transition is permitted,
  `err(InvalidTransitionError)` if it is not.
