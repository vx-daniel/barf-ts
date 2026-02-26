[**barf**](../../README.md)

***

[barf](../../modules.md) / types/schema/exec-schema

# types/schema/exec-schema

## Other

### ExecResult

> **ExecResult** = `object`

Defined in: src/types/schema/exec-schema.ts:17

A validated exec result. Derived from [ExecResultSchema](#execresultschema).

#### Type Declaration

##### status

> **status**: `number`

##### stderr

> **stderr**: `string`

##### stdout

> **stdout**: `string`

## Utilities

### ExecResultSchema

> `const` **ExecResultSchema**: `ZodObject`\<[`ExecResult`](#execresult)\>

Defined in: src/types/schema/exec-schema.ts:11

Output captured from a subprocess spawned by `execFileNoThrow`.

`status` is the process exit code (0 = success). Errors appear in `stderr`;
the function never throws.
