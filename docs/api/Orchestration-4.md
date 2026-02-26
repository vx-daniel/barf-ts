[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

Session stats persistence — tracks and writes token usage per run.

After each orchestration loop run, barf persists session statistics
(token counts, duration, iterations) to the issue. Stats are accumulated
in the issue's frontmatter fields and a human-readable block is appended
to the issue body.

Stats persistence is best-effort: failures are logged but never propagate,
because losing stats should not crash a successful build.

## Orchestration

### createSessionStats()

> **createSessionStats**(`sessionStartTime`, `totalInputTokens`, `totalOutputTokens`, `lastContextSize`, `iteration`, `model`): `object`

Defined in: src/core/batch/stats.ts:38

Creates a [SessionStats](types/schema/session-stats-schema.md#sessionstats) snapshot from the current loop state.

Captures the elapsed time, cumulative token counts, iteration count,
and model used. Called at the end of each orchestration run (both
normal completion and early exit via split).

#### Parameters

##### sessionStartTime

`number`

Unix timestamp (ms) when the session started.

##### totalInputTokens

`number`

Cumulative input tokens across all iterations.

##### totalOutputTokens

`number`

Cumulative output tokens across all iterations.

##### lastContextSize

`number`

Token count from the most recent iteration.

##### iteration

`number`

Number of iterations completed.

##### model

`string`

Model identifier used for this session.

#### Returns

A fully-populated [SessionStats](types/schema/session-stats-schema.md#sessionstats) object.

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

### persistSessionStats()

> **persistSessionStats**(`issueId`, `stats`, `provider`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/core/batch/stats.ts:76

Persists session stats to the issue: updates cumulative frontmatter totals
and appends a per-run stats block to the body.

This function is best-effort — failures are logged but never propagate.
Stats are important for observability but should not crash a successful build.

The frontmatter fields updated are:
- `total_input_tokens` — cumulative input tokens across all runs
- `total_output_tokens` — cumulative output tokens across all runs
- `total_duration_seconds` — cumulative wall-clock time
- `total_iterations` — cumulative iteration count
- `run_count` — incremented by 1

#### Parameters

##### issueId

`string`

ID of the issue to update.

##### stats

Session statistics to persist.

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

##### provider

[`IssueProvider`](Issue-Model.md#abstract-issueprovider)

Issue provider for reading and writing the issue.

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
