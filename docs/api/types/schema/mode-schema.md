[**barf**](../../README.md)

***

[barf](../../modules.md) / types/schema/mode-schema

# types/schema/mode-schema

## Modes

### AutoSelectModeSchema

> `const` **AutoSelectModeSchema**: `ZodEnum`\<[`AutoSelectMode`](#autoselectmode)\>

Defined in: src/types/schema/mode-schema.ts:50

Modes used by `IssueProvider.autoSelect` to pick the next issue.

`'split'` is excluded because split issues are handled internally by the loop.

***

### BarfModeSchema

> `const` **BarfModeSchema**: `ZodEnum`\<[`BarfMode`](#barfmode)\>

Defined in: src/types/schema/mode-schema.ts:10

Superset of all barf operational modes.

Narrower subsets are derived via `.extract()` for type-safe context-specific usage.

***

### LoopModeSchema

> `const` **LoopModeSchema**: `ZodEnum`\<[`LoopMode`](#loopmode)\>

Defined in: src/types/schema/mode-schema.ts:21

Modes used by the batch orchestration loop (`runLoop`) and POSIX locking.

`'split'` is used internally after an overflow decision.

***

### PromptModeSchema

> `const` **PromptModeSchema**: `ZodEnum`\<[`PromptMode`](#promptmode)\>

Defined in: src/types/schema/mode-schema.ts:33

Modes accepted by `resolvePromptTemplate` — plan, build, split, audit, triage.

Decoupled from [BarfModeSchema](#barfmodeschema) so prompt resolution can support modes
(audit, triage) that are not part of the batch orchestration loop.

## Other

### AutoSelectMode

> **AutoSelectMode** = `"plan"` \| `"build"`

Defined in: src/types/schema/mode-schema.ts:52

An auto-select mode. Derived from [AutoSelectModeSchema](#autoselectmodeschema).

***

### BarfMode

> **BarfMode** = `"plan"` \| `"build"` \| `"split"`

Defined in: src/types/schema/mode-schema.ts:12

A barf operational mode. Derived from [BarfModeSchema](#barfmodeschema).

***

### LoopMode

> **LoopMode** = `"plan"` \| `"build"` \| `"split"`

Defined in: src/types/schema/mode-schema.ts:23

A loop/lock mode. Derived from [LoopModeSchema](#loopmodeschema).

***

### PromptMode

> **PromptMode** = `"plan"` \| `"build"` \| `"split"` \| `"audit"` \| `"triage"`

Defined in: src/types/schema/mode-schema.ts:41

A prompt resolution mode. Derived from [PromptModeSchema](#promptmodeschema).
