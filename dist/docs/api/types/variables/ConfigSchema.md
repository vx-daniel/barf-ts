[**barf**](../../README.md)

***

[barf](../../README.md) / [types](../README.md) / ConfigSchema

# Variable: ConfigSchema

> `const` **ConfigSchema**: `ZodObject`\<[`Config`](../type-aliases/Config.md)\>

Defined in: src/types/index.ts:111

Runtime configuration for a barf project.

Loaded from `.barfrc` (KEY=VALUE format) via `loadConfig`. Falls back to
these defaults when the file is absent or a key is missing.
