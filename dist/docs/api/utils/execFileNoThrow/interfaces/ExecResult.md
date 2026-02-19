[**barf**](../../../README.md)

***

[barf](../../../README.md) / [utils/execFileNoThrow](../README.md) / ExecResult

# Interface: ExecResult

Defined in: src/utils/execFileNoThrow.ts:9

Output captured from a subprocess spawned by [execFileNoThrow](../functions/execFileNoThrow.md).
`status` is the process exit code (0 = success). Errors appear in `stderr`; the function never throws.

## Properties

### status

> **status**: `number`

Defined in: src/utils/execFileNoThrow.ts:12

***

### stderr

> **stderr**: `string`

Defined in: src/utils/execFileNoThrow.ts:11

***

### stdout

> **stdout**: `string`

Defined in: src/utils/execFileNoThrow.ts:10
