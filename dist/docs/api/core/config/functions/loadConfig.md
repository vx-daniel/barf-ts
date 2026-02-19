[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/config](../README.md) / loadConfig

# Function: loadConfig()

> **loadConfig**(`rcPath?`): `object`

Defined in: src/core/config.ts:74

Loads barf configuration from a `.barfrc` file.

Falls back to schema defaults if the file is missing or cannot be parsed.
Never throws — invalid config is silently replaced with defaults.

## Parameters

### rcPath?

`string`

Path to the `.barfrc` file. Defaults to `<cwd>/.barfrc`.

## Returns

`object`

### barfDir

> **barfDir**: `string`

### buildModel

> **buildModel**: `string`

### claudeTimeout

> **claudeTimeout**: `number`

### contextUsagePercent

> **contextUsagePercent**: `number`

### extendedContextModel

> **extendedContextModel**: `string`

### githubRepo

> **githubRepo**: `string`

### issueProvider

> **issueProvider**: `"local"` \| `"github"`

### issuesDir

> **issuesDir**: `string`

### maxAutoSplits

> **maxAutoSplits**: `number`

### maxIterations

> **maxIterations**: `number`

### planDir

> **planDir**: `string`

### planModel

> **planModel**: `string`

### pushStrategy

> **pushStrategy**: `"manual"` \| `"iteration"` \| `"on_complete"`

### splitModel

> **splitModel**: `string`

### streamLogDir

> **streamLogDir**: `string`

### testCommand

> **testCommand**: `string`
