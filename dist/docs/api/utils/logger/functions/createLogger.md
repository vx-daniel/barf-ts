[**barf**](../../../README.md)

***

[barf](../../../README.md) / [utils/logger](../README.md) / createLogger

# Function: createLogger()

> **createLogger**(`name`): `Logger`

Defined in: src/utils/logger.ts:44

Create a named child logger. The underlying pino instance is built lazily
on first use so that the log file path resolves after --cwd / process.chdir().

Writes JSON to both stderr and `barf.log` in the project directory.
Overrides: LOG_LEVEL, LOG_PRETTY=1, BARF_LOG_FILE=/abs/path

## Parameters

### name

`string`

## Returns

`Logger`
