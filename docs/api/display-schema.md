[**barf**](README.md)

***

[barf](modules.md) / display-schema

# display-schema

Display context schema — contextual fields for TTY progress rendering.

The display context is passed through the orchestration stack to enable
the sticky 2-line TTY header shown during Claude iterations. It identifies
what mode is running, which issue is being processed, and the current state.

## Display

### DisplayContext

> **DisplayContext** = `object`

Defined in: src/types/schema/display-schema.ts:39

Validated display context. Derived from [DisplayContextSchema](#displaycontextschema).

#### Type Declaration

##### issueId

> **issueId**: `string`

Issue ID being processed.

##### mode

> **mode**: `string`

Command or loop mode being executed (e.g. `'plan'`, `'build'`, `'triage'`).

##### state

> **state**: `string`

Current issue state at the time of the call.

##### title

> **title**: `string`

Issue title (truncated to 50 chars before display).

***

### DisplayContextSchema

> `const` **DisplayContextSchema**: `ZodObject`\<[`DisplayContext`](#displaycontext)\>

Defined in: src/types/schema/display-schema.ts:23

Contextual fields rendered in the 2-line sticky TTY header during a Claude iteration.

Passed to `runClaudeIteration` and `triageIssue` to identify what is running.
The header line looks like:
```
▶ build  ISSUE-123  IN_PROGRESS  Fix the login bug
```
