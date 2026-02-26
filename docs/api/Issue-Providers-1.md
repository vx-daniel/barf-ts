[**barf**](README.md)

***

[barf](modules.md) / Issue Providers

# Issue Providers

## Issue Providers

### GitHubIssueProvider

Defined in: src/core/issue/providers/github.ts:38

GitHub Issues provider. Maps the barf state machine to GitHub labels (`barf:*`).

**Prerequisites:** The `gh` CLI must be authenticated (`gh auth login`).

**Locking:** Uses a `barf:locked` label — not POSIX-atomic. Designed for
single-agent use; concurrent agents on the same repo may race.

**Deletion:** GitHub issues cannot be deleted via the API. `deleteIssue` returns
`err` — transition to `COMPLETED` instead.

**Testing:** Pass a `spawnFn` to inject a mock `gh` implementation in tests.
This avoids real network calls without `mock.module` process-global patching.

#### Extends

- [`IssueProvider`](Issue-Model.md#abstract-issueprovider)

#### Constructors

##### Constructor

> **new GitHubIssueProvider**(`repo`, `spawnFn?`): [`GitHubIssueProvider`](#githubissueprovider)

Defined in: src/core/issue/providers/github.ts:42

###### Parameters

###### repo

`string`

###### spawnFn?

[`SpawnFn`](#spawnfn)

###### Returns

[`GitHubIssueProvider`](#githubissueprovider)

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`constructor`](Issue-Model.md#constructor)

#### Derived

##### autoSelect()

> **autoSelect**(`mode`): [`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \} \| `null`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:178

Selects the highest-priority available (unlocked) issue for the given mode.

Priority order per [AutoSelectMode](types/schema/mode-schema.md#autoselectmode):
- `plan`: NEW
- `build`: IN_PROGRESS → PLANNED → NEW

###### Parameters

###### mode

Determines which states are considered and their priority order.

`"plan"` | `"build"`

###### Returns

[`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \} \| `null`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` for the best candidate, `ok(null)` if no eligible unlocked issue exists,
  or `err(Error)` on I/O failure.

###### Inherited from

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`autoSelect`](Issue-Model.md#autoselect)

##### checkAcceptanceCriteria()

> **checkAcceptanceCriteria**(`id`): [`ResultAsync`](#)\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:207

Checks whether all acceptance criteria checkboxes in the issue body are ticked.
Delegates parsing to [parseAcceptanceCriteria](Issue-Model-2.md#parseacceptancecriteria).

###### Parameters

###### id

`string`

Issue to inspect.

###### Returns

[`ResultAsync`](#)\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(true)` if all criteria are checked (or the section is absent),
  `ok(false)` if any `- [ ]` item remains, or `err(Error)` if the issue cannot be fetched.

###### Inherited from

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`checkAcceptanceCriteria`](Issue-Model.md#checkacceptancecriteria)

##### transition()

> **transition**(`id`, `to`): [`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:156

Validates and applies a state transition.

Delegates validation to [validateTransition](Issue-Model-2.md#validatetransition); writes the new state via
[writeIssue](Issue-Model.md#writeissue). Call this instead of patching `state` directly to preserve invariants.

###### Parameters

###### id

`string`

Issue whose state will change.

###### to

Target state; must be reachable from the current state per `VALID_TRANSITIONS`.

`"NEW"` | `"PLANNED"` | `"IN_PROGRESS"` | `"STUCK"` | `"SPLIT"` | `"COMPLETED"` | `"VERIFIED"`

###### Returns

[`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` with the updated issue, `err(InvalidTransitionError)` if the move is illegal,
  or `err(Error)` on I/O failure.

###### Inherited from

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`transition`](Issue-Model.md#transition)

#### I/O — Override in Provider

##### createIssue()

> **createIssue**(`input`): [`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:103

Creates a new issue with state `NEW`.

###### Parameters

###### input

`title` is required; `body` and `parent` are optional.

###### body?

`string`

###### parent?

`string`

###### title

`string`

###### Returns

[`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` with the persisted issue (including assigned id), `err(Error)` on I/O or API failure.

###### Example

```ts
const result = await provider.createIssue({ title: 'Fix login bug', body: '...' });
if (result.isErr()) logger.error({ err: result.error }, 'create failed');
```

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`createIssue`](Issue-Model.md#createissue)

##### deleteIssue()

> **deleteIssue**(`_id`): [`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:188

Permanently deletes an issue.
GitHub provider always returns `err` — use `transition(id, 'COMPLETED')` there.

###### Parameters

###### \_id

`string`

###### Returns

[`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` on success, `err(Error)` on I/O failure or if deletion is unsupported.

###### Example

```ts
const result = await provider.deleteIssue('001');
if (result.isErr()) logger.warn({ err: result.error }, 'delete unsupported, transition instead');
```

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`deleteIssue`](Issue-Model.md#deleteissue)

##### fetchIssue()

> **fetchIssue**(`id`): [`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:88

Retrieves a single issue by ID.

###### Parameters

###### id

`string`

Issue identifier (e.g. `'001'` for local, GitHub issue number for github).

###### Returns

[`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` on success, `err(Error)` if the issue does not exist or cannot be read.

###### Example

```ts
const result = await provider.fetchIssue('001');
if (result.isErr()) logger.error({ err: result.error }, 'fetch failed');
```

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`fetchIssue`](Issue-Model.md#fetchissue)

##### isLocked()

> **isLocked**(`id`): [`ResultAsync`](#)\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:226

Checks whether the issue is currently locked by any process.

###### Parameters

###### id

`string`

Issue to check.

###### Returns

[`ResultAsync`](#)\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(true)` if locked, `ok(false)` if not, `err(Error)` on I/O or API failure.

###### Example

```ts
const result = await provider.isLocked('001');
if (result.isOk() && result.value) logger.warn({ id: '001' }, 'issue is locked, skipping');
```

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`isLocked`](Issue-Model.md#islocked)

##### listIssues()

> **listIssues**(`filter?`): [`ResultAsync`](#)\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:94

Lists all issues, optionally filtered by state.

###### Parameters

###### filter?

If `filter.state` is set, only issues in that state are returned.

###### state?

`"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`

###### Returns

[`ResultAsync`](#)\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue[])` on success, `err(Error)` on I/O or API failure.

###### Example

```ts
const result = await provider.listIssues({ state: 'NEW' });
if (result.isOk()) result.value.forEach(i => logger.info({ id: i.id }, 'found'));
```

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`listIssues`](Issue-Model.md#listissues)

##### lockIssue()

> **lockIssue**(`id`, `_meta?`): [`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:196

Acquires an exclusive lock on the issue.

- `LocalIssueProvider`: `O_CREAT | O_EXCL` atomic file creation in `.barf/<id>.lock`
- `GitHubIssueProvider`: adds the `barf:locked` label (meta ignored)

###### Parameters

###### id

`string`

Issue to lock.

###### \_meta?

###### mode?

`"plan"` \| `"build"` \| `"split"`

###### Returns

[`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` on success, `err(Error)` if the issue is already locked.

###### Example

```ts
const result = await provider.lockIssue('001', { mode: 'build' });
if (result.isErr()) throw new Error('Already locked by another process');
```

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`lockIssue`](Issue-Model.md#lockissue)

##### unlockIssue()

> **unlockIssue**(`id`): [`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:212

Releases the lock acquired by [lockIssue](Issue-Model.md#lockissue). Safe to call if not locked.

###### Parameters

###### id

`string`

Issue to unlock.

###### Returns

[`ResultAsync`](#)\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` always — implementations must not return `err` for a no-op unlock.

###### Example

```ts
await provider.unlockIssue('001'); // safe even if not currently locked
```

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`unlockIssue`](Issue-Model.md#unlockissue)

##### writeIssue()

> **writeIssue**(`id`, `fields`): [`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:135

Patches an issue's fields. Implementations must write atomically.
The `id` field cannot be patched — it is excluded from `fields`.

###### Parameters

###### id

`string`

Issue to update.

###### fields

[`Partial`](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype)\<[`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)\<[`Issue`](issue-schema.md#issue), `"id"`\>\>

Subset of [Issue](issue-schema.md#issue) fields to overwrite; `id` is excluded.

###### Returns

[`ResultAsync`](#)\<\{ `body`: `string`; `children`: `string`[]; `context_usage_percent?`: `number`; `force_split`: `boolean`; `id`: `string`; `is_verify_fix?`: `boolean`; `needs_interview?`: `boolean`; `parent`: `string`; `run_count`: `number`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"` \| `"VERIFIED"`; `title`: `string`; `total_duration_seconds`: `number`; `total_input_tokens`: `number`; `total_iterations`: `number`; `total_output_tokens`: `number`; `verify_count`: `number`; `verify_exhausted?`: `boolean`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` with the full updated issue, `err(Error)` on I/O or API failure.

###### Example

```ts
const result = await provider.writeIssue('001', { title: 'Updated title' });
if (result.isErr()) logger.error({ err: result.error }, 'write failed');
```

###### Overrides

[`IssueProvider`](Issue-Model.md#abstract-issueprovider).[`writeIssue`](Issue-Model.md#writeissue)

***

### SpawnFn()

> **SpawnFn** = (`file`, `args?`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](types/schema/exec-schema.md#execresult)\>

Defined in: src/core/issue/providers/github.ts:20

Injectable subprocess function matching the [execFileNoThrow](Utilities.md#execfilenothrow) signature.
Pass a mock in tests to avoid real `gh` CLI network calls without process-global patching.

#### Parameters

##### file

`string`

##### args?

`string`[]

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<[`ExecResult`](types/schema/exec-schema.md#execresult)\>
