[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

TTY display functions — progress rendering for Claude iterations.

These pure functions handle the terminal output during Claude sessions:
a sticky header line showing what's running, a progress line showing
context usage, and ANSI escape sequences to clear them when done.

Extracted from the stream consumer so display logic is independently
testable and the stream module can focus on message processing.

## Display

### clearProgress()

> **clearProgress**(`hasHeader`, `stderrWrite`): `void`

Defined in: src/core/claude/display.ts:84

Clears the progress line (and header line if present) using ANSI escape sequences.

When a header was written (displayContext provided), clears two lines
(progress + header). Otherwise clears just the progress line.

#### Parameters

##### hasHeader

`boolean`

Whether a header line was written above the progress line.

##### stderrWrite

(`data`) => `void`

Sink function for TTY output.

#### Returns

`void`

***

### writeHeader()

> **writeHeader**(`displayContext`, `stderrWrite`): `void`

Defined in: src/core/claude/display.ts:33

Writes the sticky header line identifying the current operation.

Renders a single line like:
```
▶ build  ISSUE-123  IN_PROGRESS  Fix the login bug
```

#### Parameters

##### displayContext

Context fields for the header (mode, issueId, state, title).

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

##### stderrWrite

(`data`) => `void`

Sink function for TTY output (typically `process.stderr.write`).

#### Returns

`void`

***

### writeProgress()

> **writeProgress**(`tokens`, `contextLimit`, `lastTool`, `stderrWrite`): `void`

Defined in: src/core/claude/display.ts:61

Writes the context usage progress line.

Overwrites the current line (using `\r\x1b[K`) with:
```
  context: 150,000 / 200,000 (75%)  |  Read
```

#### Parameters

##### tokens

`number`

Current cumulative input token count.

##### contextLimit

`number`

Model's total context window size.

##### lastTool

`string`

Name of the most recent tool invocation (empty string if none).

##### stderrWrite

(`data`) => `void`

Sink function for TTY output.

#### Returns

`void`
