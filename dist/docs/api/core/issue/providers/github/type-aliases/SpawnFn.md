[**barf**](../../../../../README.md)

***

[barf](../../../../../README.md) / [core/issue/providers/github](../README.md) / SpawnFn

# Type Alias: SpawnFn()

> **SpawnFn** = (`file`, `args?`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](../../../../../utils/execFileNoThrow/interfaces/ExecResult.md)\>

Defined in: src/core/issue/providers/github.ts:13

Injectable subprocess function matching the [execFileNoThrow](../../../../../utils/execFileNoThrow/functions/execFileNoThrow.md) signature.
Pass a mock in tests to avoid real `gh` CLI network calls without process-global patching.

## Parameters

### file

`string`

### args?

`string`[]

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](../../../../../utils/execFileNoThrow/interfaces/ExecResult.md)\>
