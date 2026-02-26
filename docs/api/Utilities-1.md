[**barf**](README.md)

***

[barf](modules.md) / Utilities

# Utilities

## Other

### setLoggerConfig()

> **setLoggerConfig**(`config`): `void`

Defined in: src/utils/logger.ts:22

Injects runtime config into the logger subsystem.

Must be called in the `preAction` hook (after `process.chdir()`) so that
`logFile` resolves relative to the correct working directory. Priority for
each setting: config value → environment variable → built-in default.

#### Parameters

##### config

[`LoggerConfig`](#loggerconfig)

Logger-relevant slice of the loaded [Config](config-schema.md#config).

#### Returns

`void`

## Utilities

### LoggerConfig

> **LoggerConfig** = [`Pick`](https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys)\<[`Config`](config-schema.md#config), `"logFile"` \| `"logLevel"` \| `"logPretty"`\>

Defined in: src/utils/logger.ts:9

Subset of [Config](config-schema.md#config) consumed by the logger.

***

### logger

> `const` **logger**: `Logger`\<`never`, `boolean`\>

Defined in: src/utils/logger.ts:81

Root logger for src/index.ts and top-level use.

***

### createLogger()

> **createLogger**(`name`): `Logger`

Defined in: src/utils/logger.ts:65

Create a named child logger. The underlying pino instance is built lazily
on first use so that the log file path resolves after `--cwd` / `process.chdir()`.

Priority for each setting: [setLoggerConfig](#setloggerconfig) value → env var → default.
Environment overrides: `LOG_LEVEL`, `LOG_PRETTY=1`, `BARF_LOG_FILE=/abs/path`.

#### Parameters

##### name

`string`

#### Returns

`Logger`
