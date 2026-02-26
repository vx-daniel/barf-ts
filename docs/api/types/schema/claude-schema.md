[**barf**](../../README.md)

***

[barf](../../modules.md) / types/schema/claude-schema

# types/schema/claude-schema

## Claude Agent

### IterationOutcomeSchema

> `const` **IterationOutcomeSchema**: `ZodEnum`\<[`IterationOutcome`](#iterationoutcome)\>

Defined in: src/types/schema/claude-schema.ts:12

Outcome of a single Claude agent iteration.
- `success`: iteration completed normally
- `overflow`: context threshold exceeded
- `error`: Claude exited with a non-success status or timed out
- `rate_limited`: API rate limit hit; see `rateLimitResetsAt` for retry time

***

### IterationResultSchema

> `const` **IterationResultSchema**: `ZodObject`\<[`IterationResult`](#iterationresult)\>

Defined in: src/types/schema/claude-schema.ts:29

Result of a single Claude agent iteration, returned by `runClaudeIteration`.

`tokens` (input) and `outputTokens` are always populated.
`rateLimitResetsAt` is set only when `outcome === 'rate_limited'`.

## Other

### IterationOutcome

> **IterationOutcome** = `"success"` \| `"error"` \| `"overflow"` \| `"rate_limited"`

Defined in: src/types/schema/claude-schema.ts:19

An iteration outcome. Derived from [IterationOutcomeSchema](#iterationoutcomeschema).

***

### IterationResult

> **IterationResult** = `object`

Defined in: src/types/schema/claude-schema.ts:36

A validated iteration result. Derived from [IterationResultSchema](#iterationresultschema).

#### Type Declaration

##### outcome

> **outcome**: `"success"` \| `"error"` \| `"overflow"` \| `"rate_limited"` = `IterationOutcomeSchema`

##### outputTokens

> **outputTokens**: `number`

##### rateLimitResetsAt?

> `optional` **rateLimitResetsAt**: `number`

##### tokens

> **tokens**: `number`
