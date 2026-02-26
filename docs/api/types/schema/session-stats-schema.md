[**barf**](../../README.md)

***

[barf](../../modules.md) / types/schema/session-stats-schema

# types/schema/session-stats-schema

## Other

### SessionStats

> **SessionStats** = `object`

Defined in: src/types/schema/session-stats-schema.ts:27

A validated session stats object. Derived from [SessionStatsSchema](#sessionstatsschema).

#### Type Declaration

##### durationSeconds

> **durationSeconds**: `number`

Wall-clock duration in seconds.

##### finalContextSize

> **finalContextSize**: `number`

Final context size (input tokens) at end of last iteration.

##### inputTokens

> **inputTokens**: `number`

Cumulative input tokens (base + cache_creation + cache_read) across all iterations.

##### iterations

> **iterations**: `number`

Number of iterations executed.

##### model

> **model**: `string`

Model used for this session (last model if escalated).

##### outputTokens

> **outputTokens**: `number`

Cumulative output tokens across all iterations.

##### startedAt

> **startedAt**: `string`

ISO 8601 timestamp when the session started.

***

### formatSessionStatsBlock()

> **formatSessionStatsBlock**(`stats`): `string`

Defined in: src/types/schema/session-stats-schema.ts:35

Formats a [SessionStats](#sessionstats) object as a markdown block for appending to an issue body.

#### Parameters

##### stats

Session stats to format

###### durationSeconds

`number` = `...`

Wall-clock duration in seconds.

###### finalContextSize

`number` = `...`

Final context size (input tokens) at end of last iteration.

###### inputTokens

`number` = `...`

Cumulative input tokens (base + cache_creation + cache_read) across all iterations.

###### iterations

`number` = `...`

Number of iterations executed.

###### model

`string` = `...`

Model used for this session (last model if escalated).

###### outputTokens

`number` = `...`

Cumulative output tokens across all iterations.

###### startedAt

`string` = `...`

ISO 8601 timestamp when the session started.

#### Returns

`string`

Markdown string with a horizontal rule and stats details

## Stats

### SessionStatsSchema

> `const` **SessionStatsSchema**: `ZodObject`\<[`SessionStats`](#sessionstats)\>

Defined in: src/types/schema/session-stats-schema.ts:9

Statistics for a single Claude session/run on an issue.
Tracked across all iterations within one `runLoop` invocation.
