[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/issue](../README.md) / VALID\_TRANSITIONS

# Variable: VALID\_TRANSITIONS

> `const` **VALID\_TRANSITIONS**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<[`IssueState`](../../../types/type-aliases/IssueState.md), [`IssueState`](../../../types/type-aliases/IssueState.md)[]\>

Defined in: src/core/issue/index.ts:13

The allowed state transitions in the barf issue lifecycle.

Used by [validateTransition](../functions/validateTransition.md) to reject illegal moves.
Terminal states (`SPLIT`, `COMPLETED`) have empty arrays — no further transitions allowed.
