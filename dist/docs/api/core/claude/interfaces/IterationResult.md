[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/claude](../README.md) / IterationResult

# Interface: IterationResult

Defined in: src/core/claude.ts:29

Result of a single Claude agent iteration, returned by [runClaudeIteration](../functions/runClaudeIteration.md).

`tokens` is always populated. `rateLimitResetsAt` is set only when `outcome === 'rate_limited'`.

## Properties

### outcome

> **outcome**: [`IterationOutcome`](../type-aliases/IterationOutcome.md)

Defined in: src/core/claude.ts:30

***

### rateLimitResetsAt?

> `optional` **rateLimitResetsAt**: `number`

Defined in: src/core/claude.ts:32

***

### tokens

> **tokens**: `number`

Defined in: src/core/claude.ts:31
