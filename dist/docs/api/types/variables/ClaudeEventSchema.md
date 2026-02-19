[**barf**](../../README.md)

***

[barf](../../README.md) / [types](../README.md) / ClaudeEventSchema

# Variable: ClaudeEventSchema

> `const` **ClaudeEventSchema**: `ZodDiscriminatedUnion`\<[`ClaudeEvent`](../type-aliases/ClaudeEvent.md)\>

Defined in: src/types/index.ts:150

A structured event emitted by the Claude stream parser.

- `usage`: cumulative token count from the main conversation context
- `tool`: a tool invocation name from an assistant message

Emitted by `parseClaudeStream` in `core/context`.
