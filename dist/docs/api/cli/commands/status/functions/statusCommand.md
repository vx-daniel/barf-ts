[**barf**](../../../../README.md)

***

[barf](../../../../README.md) / [cli/commands/status](../README.md) / statusCommand

# Function: statusCommand()

> **statusCommand**(`provider`, `opts`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/cli/commands/status.ts:17

Lists all issues and their current state.

**text format (default):** Logs one line per issue (`id`, `state`, `title`).
**json format:** Emits the full issue array as a structured log object.

Exits with code 1 if the provider list call fails.

## Parameters

### provider

[`IssueProvider`](../../../../core/issue/base/classes/IssueProvider.md)

Issue provider to query.

### opts

`format`: output format — `'text'` or `'json'`.

#### format

`"text"` \| `"json"`

## Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
