[**barf**](../../../README.md)

***

[barf](../../../README.md) / [utils/execFileNoThrow](../README.md) / execFileNoThrow

# Function: execFileNoThrow()

> **execFileNoThrow**(`file`, `args?`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](../interfaces/ExecResult.md)\>

Defined in: src/utils/execFileNoThrow.ts:21

Runs a subprocess without a shell — args are passed as an array, preventing
shell injection. Never throws; errors surface as non-zero status + stderr.

## Parameters

### file

`string`

### args?

`string`[] = `[]`

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](../interfaces/ExecResult.md)\>
