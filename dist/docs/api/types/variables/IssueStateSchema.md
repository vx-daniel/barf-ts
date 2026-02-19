[**barf**](../../README.md)

***

[barf](../../README.md) / [types](../README.md) / IssueStateSchema

# Variable: IssueStateSchema

> `const` **IssueStateSchema**: `ZodEnum`\<[`IssueState`](../type-aliases/IssueState.md)\>

Defined in: src/types/index.ts:19

All valid states an issue can occupy.

```
NEW → PLANNED → IN_PROGRESS → COMPLETED
         ↘           ↘
          STUCK ←→ SPLIT
```

Transitions are enforced by `validateTransition` — never mutate state directly.
