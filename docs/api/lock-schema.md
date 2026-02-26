[**barf**](README.md)

***

[barf](modules.md) / lock-schema

# lock-schema

Lock model schemas — POSIX file locking for concurrent issue access.

Barf uses lock files under `.barf/<id>.lock` to prevent multiple processes
from working on the same issue simultaneously. The lock file contains JSON
matching [LockInfoSchema](#lockinfoschema), which enables stale-lock detection (by
checking if the PID is still alive) and status display.

## Locking

### LockInfo

> **LockInfo** = `object`

Defined in: src/types/schema/lock-schema.ts:62

Parsed lock file contents. Derived from [LockInfoSchema](#lockinfoschema).

#### Type Declaration

##### acquiredAt

> **acquiredAt**: `string`

ISO 8601 timestamp of when the lock was acquired.

##### mode

> **mode**: `"plan"` \| `"build"` \| `"split"` = `LockModeSchema`

Orchestration mode that acquired the lock (plan, build, or split).

##### pid

> **pid**: `number`

PID of the process that acquired this lock. Used for stale-lock detection.

##### state

> **state**: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"` = `IssueStateSchema`

Issue state at the time the lock was acquired.

***

### LockMode

> **LockMode** = `"plan"` \| `"build"` \| `"split"`

Defined in: src/types/schema/lock-schema.ts:32

A barf lock mode. Derived from [LockModeSchema](#lockmodeschema).

***

### LockInfoSchema

> `const` **LockInfoSchema**: `ZodObject`\<[`LockInfo`](#lockinfo)\>

Defined in: src/types/schema/lock-schema.ts:45

Contents of a `.barf/<id>.lock` file.

Written atomically at lock acquisition using `O_CREAT | O_EXCL` for POSIX
safety. The `pid` field enables stale-lock detection: if the process that
created the lock is no longer alive, the lock is considered stale and
can be cleaned up automatically.

***

### LockModeSchema

> `const` **LockModeSchema**: `ZodEnum`\<[`LockMode`](#lockmode)\> = `LoopModeSchema`

Defined in: src/types/schema/lock-schema.ts:24

Runtime mode that acquired the lock.

Alias for [LoopModeSchema](types/schema/mode-schema.md#loopmodeschema) — locks are only acquired during
orchestration loop execution (plan, build, or split modes).
