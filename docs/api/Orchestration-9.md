[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

SDK stream consumer — iterates Claude agent SDK messages and tracks tokens.

This is the core of barf's Claude integration. It consumes the async
message stream from the Claude agent SDK, tracking:
- Cumulative input tokens (for context overflow detection)
- Output tokens (for stats)
- Tool invocations (for TTY progress display)
- Rate limit errors (from assistant messages and result messages)

Only main-context assistant messages (`parent_tool_use_id === null`) count
toward the threshold — sub-agent tokens are ignored to prevent premature
interruption during tool calls.

## Claude Agent

### consumeSDKQuery()

> **consumeSDKQuery**(`q`, `threshold`, `contextLimit`, `streamLogFile`, `isTTY`, `stderrWrite`, `signal`, `displayContext?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `outcome`: `"success"` \| `"error"` \| `"overflow"` \| `"rate_limited"`; `outputTokens`: `number`; `rateLimitResetsAt?`: `number`; `tokens`: `number`; \}\>

Defined in: src/core/claude/stream.ts:50

Iterates an SDK query stream, tracking token usage and tool calls.

Exported for direct testing with injected mock `Query` objects. The function
handles three concerns:
1. **Token tracking** — counts input tokens from main-context messages
2. **Overflow detection** — interrupts when tokens exceed the threshold
3. **Error classification** — maps SDK errors to domain errors

TTY display (header, progress, cleanup) is delegated to `display.ts`.
Stream logging (JSONL) is handled inline via an optional write stream.

#### Parameters

##### q

[`Query`](#)

Active SDK query to consume.

##### threshold

`number`

Token count at which to interrupt and return `'overflow'`.

##### contextLimit

`number`

Model's total context window size, used for TTY progress display.

##### streamLogFile

Optional path; each SDK message is appended as a JSON line.

`string` | `undefined`

##### isTTY

`boolean`

When true, writes a live progress line via `stderrWrite`.

##### stderrWrite

(`data`) => `void`

Sink for TTY progress output.

##### signal

[`AbortSignal`](https://developer.mozilla.org/docs/Web/API/AbortSignal)

When aborted, `q.interrupt()` is called and outcome is `'error'`.

##### displayContext?

When provided and `isTTY` is true, renders a sticky header line above the progress line.

###### issueId

`string` = `...`

Issue ID being processed.

###### mode

`string` = `...`

Command or loop mode being executed (e.g. `'plan'`, `'build'`, `'triage'`).

###### state

`string` = `...`

Current issue state at the time of the call.

###### title

`string` = `...`

Issue title (truncated to 50 chars before display).

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `outcome`: `"success"` \| `"error"` \| `"overflow"` \| `"rate_limited"`; `outputTokens`: `number`; `rateLimitResetsAt?`: `number`; `tokens`: `number`; \}\>

`IterationResult` with outcome and token count.
