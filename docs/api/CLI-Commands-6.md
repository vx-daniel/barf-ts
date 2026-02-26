[**barf**](README.md)

***

[barf](modules.md) / CLI Commands

# CLI Commands

## Functions

### statusCommand()

> **statusCommand**(`provider`, `opts`): [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>

Defined in: src/cli/commands/status.ts:18

Lists all issues and their current state.

**text format (default):** Logs one line per issue (`id`, `state`, `title`).
**json format:** Emits the full issue array as a structured log object.

Exits with code 1 if the provider list call fails.

#### Parameters

##### provider

[`IssueProvider`](Issue-Model.md#abstract-issueprovider)

Issue provider to query.

##### opts

`format`: output format — `'text'` or `'json'`.

###### format

`"text"` \| `"json"`

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<`void`\>
