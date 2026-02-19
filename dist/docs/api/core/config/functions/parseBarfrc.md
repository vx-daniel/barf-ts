[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/config](../README.md) / parseBarfrc

# Function: parseBarfrc()

> **parseBarfrc**(`content`): `Result`\<\{ `barfDir`: `string`; `buildModel`: `string`; `claudeTimeout`: `number`; `contextUsagePercent`: `number`; `extendedContextModel`: `string`; `githubRepo`: `string`; `issueProvider`: `"local"` \| `"github"`; `issuesDir`: `string`; `maxAutoSplits`: `number`; `maxIterations`: `number`; `planDir`: `string`; `planModel`: `string`; `pushStrategy`: `"manual"` \| `"iteration"` \| `"on_complete"`; `splitModel`: `string`; `streamLogDir`: `string`; `testCommand`: `string`; \}, `ZodError`\<`unknown`\>\>

Defined in: src/core/config.ts:25

Parses a `.barfrc` KEY=VALUE string into a validated [Config](../../../types/type-aliases/Config.md).

Only recognises keys listed in the internal KEY_MAP; unknown keys are silently ignored.

## Parameters

### content

`string`

Raw `.barfrc` file contents.

## Returns

`Result`\<\{ `barfDir`: `string`; `buildModel`: `string`; `claudeTimeout`: `number`; `contextUsagePercent`: `number`; `extendedContextModel`: `string`; `githubRepo`: `string`; `issueProvider`: `"local"` \| `"github"`; `issuesDir`: `string`; `maxAutoSplits`: `number`; `maxIterations`: `number`; `planDir`: `string`; `planModel`: `string`; `pushStrategy`: `"manual"` \| `"iteration"` \| `"on_complete"`; `splitModel`: `string`; `streamLogDir`: `string`; `testCommand`: `string`; \}, `ZodError`\<`unknown`\>\>

`ok(Config)` on success, `err(ZodError)` if a required field fails validation.
