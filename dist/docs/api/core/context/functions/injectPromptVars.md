[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/context](../README.md) / injectPromptVars

# Function: injectPromptVars()

> **injectPromptVars**(`template`, `vars`): `string`

Defined in: src/core/context.ts:170

Injects barf template variables into a prompt string.
Simple string replacement — no eval, no shell, injection-safe.

## Parameters

### template

`string`

Raw prompt template containing `${BARF_*}` or `$BARF_*` placeholders.

### vars

Substitution values for each supported placeholder.

#### issueFile

`string`

#### issueId

`string`

#### issuesDir

`string`

#### iteration

`number`

#### mode

`string`

#### planDir

`string`

## Returns

`string`

The template string with all recognized placeholders replaced by their string values.
