[**barf**](../../README.md)

***

[barf](../../README.md) / [types](../README.md) / LockInfo

# Type Alias: LockInfo

> **LockInfo** = `object`

Defined in: src/types/index.ts:98

Parsed lock file contents. Derived from [LockInfoSchema](../variables/LockInfoSchema.md).

## Type Declaration

### acquiredAt

> **acquiredAt**: `string`

### mode

> **mode**: `"split"` \| `"plan"` \| `"build"` = `LockModeSchema`

### pid

> **pid**: `number`

### state

> **state**: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` = `IssueStateSchema`
