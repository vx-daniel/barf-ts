[**barf**](README.md)

***

[barf](modules.md) / Utilities

# Utilities

## Other

### ExecResult

Re-exports [ExecResult](types/schema/exec-schema.md#execresult)

## Utilities

### execFileNoThrow()

> **execFileNoThrow**(`file`, `args?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `status`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

Defined in: src/utils/execFileNoThrow.ts:13

Runs a subprocess without a shell — args are passed as an array, preventing
shell injection. Never throws; errors surface as non-zero status + stderr.

#### Parameters

##### file

`string`

##### args?

`string`[] = `[]`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `status`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>
