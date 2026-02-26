[**barf**](README.md)

***

[barf](modules.md) / events-schema

# events-schema

Claude stream event schemas — structured events emitted during SDK iteration.

These events are emitted by `consumeSDKQuery` in `core/claude/stream.ts` as
it processes the Claude agent SDK message stream. They provide real-time
observability into token usage and tool invocations during a Claude session.

## Claude Stream

### ClaudeEvent

> **ClaudeEvent** = \{ `tokens`: `number`; `type`: `"usage"`; \} \| \{ `name`: `string`; `type`: `"tool"`; \}

Defined in: src/types/schema/events-schema.ts:36

A parsed Claude stream event. Derived from [ClaudeEventSchema](#claudeeventschema).

***

### ClaudeEventSchema

> `const` **ClaudeEventSchema**: `ZodDiscriminatedUnion`\<[`ClaudeEvent`](#claudeevent)\>

Defined in: src/types/schema/events-schema.ts:25

A structured event emitted during SDK iteration.

Uses a discriminated union on the `type` field:
- `'usage'` — cumulative token count from the main conversation context
- `'tool'` — a tool invocation name extracted from an assistant message

These events power the TTY progress display and context monitoring that
triggers overflow decisions (split or escalate to a larger model).
