[**barf**](../../README.md)

***

[barf](../../README.md) / [types](../README.md) / LockInfoSchema

# Variable: LockInfoSchema

> `const` **LockInfoSchema**: `ZodObject`\<[`LockInfo`](../type-aliases/LockInfo.md)\>

Defined in: src/types/index.ts:86

Contents of a `.barf/<id>.lock` file. Written atomically at lock acquisition.
Used for stale-lock detection (dead PID) and status display.
