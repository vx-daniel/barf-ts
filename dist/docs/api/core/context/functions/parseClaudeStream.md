[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/context](../README.md) / parseClaudeStream

# Function: parseClaudeStream()

> **parseClaudeStream**(`proc`, `threshold`, `streamLogFile?`): [`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<\{ `tokens`: `number`; `type`: `"usage"`; \} \| \{ `name`: `string`; `type`: `"tool"`; \}\>

Defined in: src/core/context.ts:68

Async generator that parses Claude's --output-format stream-json stdout.
Yields [ClaudeEvent](../../../types/type-aliases/ClaudeEvent.md) (usage | tool). Kills proc and throws on overflow or rate limit.

Token tracking: only from main context (parent_tool_use_id === null).
Sub-agent tokens are ignored to prevent premature interruption during tool calls.

## Parameters

### proc

The Claude subprocess; must expose a readable `stdout` and a `kill` method.

#### kill

(`signal?`) => `void`

#### stdout

[`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream)\<[`Uint8Array`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)\<`ArrayBufferLike`\>\>

### threshold

`number`

Token count at which to kill the process and throw [ContextOverflowError](../classes/ContextOverflowError.md).

### streamLogFile?

`string`

Optional file path; each raw JSONL line is appended for debugging.

## Returns

[`AsyncGenerator`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator)\<\{ `tokens`: `number`; `type`: `"usage"`; \} \| \{ `name`: `string`; `type`: `"tool"`; \}\>

Async generator yielding [ClaudeEvent](../../../types/type-aliases/ClaudeEvent.md) objects; throws [ContextOverflowError](../classes/ContextOverflowError.md)
  on threshold breach or [RateLimitError](../classes/RateLimitError.md) on API rate limiting.
