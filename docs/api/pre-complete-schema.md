[**barf**](README.md)

***

[barf](modules.md) / pre-complete-schema

# pre-complete-schema

Pre-completion schemas — data structures for the pre-complete gate.

Before marking an issue as COMPLETED, barf runs fix commands (best-effort)
and a test gate (hard requirement). These schemas define the fix step
definitions and the outcome of the pre-completion checks.

## Pre-Completion

### FixStep

> **FixStep** = `object`

Defined in: src/types/schema/pre-complete-schema.ts:33

A fix step definition. Derived from [FixStepSchema](#fixstepschema).

#### Type Declaration

##### command

> **command**: `string`

Shell command to execute via `sh -c`.

##### name

> **name**: `string`

Human-readable name for this step (derived from first word of command).

***

### PreCompleteResult

> **PreCompleteResult** = \{ `passed`: `true`; \} \| \{ `passed`: `false`; `testFailure`: \{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}; \}

Defined in: src/types/schema/pre-complete-schema.ts:64

Pre-completion outcome. Derived from [PreCompleteResultSchema](#precompleteresultschema).

***

### FixStepSchema

> `const` **FixStepSchema**: `ZodObject`\<[`FixStep`](#fixstep)\>

Defined in: src/types/schema/pre-complete-schema.ts:21

A fix command to run before testing.

Fix steps are derived from the `fixCommands` config array. Each command
is run via `sh -c` before the test gate. Failures are logged but do not
block — they are best-effort cleanup (e.g. auto-formatting, lint --fix).

***

### PreCompleteResultSchema

> `const` **PreCompleteResultSchema**: `ZodDiscriminatedUnion`\<[`PreCompleteResult`](#precompleteresult)\>

Defined in: src/types/schema/pre-complete-schema.ts:44

Outcome of the pre-completion checks.

Uses a discriminated union on the `passed` field:
- `{ passed: true }` — all fix steps ran and test gate passed (or was skipped)
- `{ passed: false, testFailure }` — the test gate command failed, with output details
