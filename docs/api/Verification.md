[**barf**](README.md)

***

[barf](modules.md) / Verification

# Verification

## Functions

### runPreComplete()

> **runPreComplete**(`fixSteps`, `testCommand`, `execFn?`): [`ResultAsync`](#)\<\{ `passed`: `true`; \} \| \{ `passed`: `false`; `testFailure`: \{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}; \}, `never`\>

Defined in: src/core/pre-complete.ts:37

Runs pre-completion checks: fix commands (best-effort) then test gate (hard requirement).

Fix commands run sequentially via `sh -c`. Failures are logged but do not block.
If `testCommand` is set, it must exit 0 for the result to be `{ passed: true }`.

#### Parameters

##### fixSteps

`object`[]

Fix commands to run (best-effort).

##### testCommand

Shell command that must pass; `undefined` or empty to skip.

`string` | `undefined`

##### execFn?

[`ExecFn`](Verification-1.md#execfn) = `execFileNoThrow`

Injectable subprocess executor.

#### Returns

[`ResultAsync`](#)\<\{ `passed`: `true`; \} \| \{ `passed`: `false`; `testFailure`: \{ `exitCode`: `number`; `stderr`: `string`; `stdout`: `string`; \}; \}, `never`\>

`ok({ passed: true })` or `ok({ passed: false, testFailure })`. Never errors.

***

### toFixSteps()

> **toFixSteps**(`commands`): `object`[]

Defined in: src/core/pre-complete.ts:19

Converts config `fixCommands` strings into [FixStep](pre-complete-schema.md#fixstep) entries.
Each command string becomes a named step (name derived from first word).

#### Parameters

##### commands

`string`[]

Raw command strings from config (e.g. `['biome check --apply']`).

#### Returns

Array of [FixStep](pre-complete-schema.md#fixstep) ready for [runPreComplete](#runprecomplete).

## References

### FixStep

Re-exports [FixStep](pre-complete-schema.md#fixstep)

***

### PreCompleteResult

Re-exports [PreCompleteResult](pre-complete-schema.md#precompleteresult)
