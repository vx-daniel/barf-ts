[**barf**](../../../../../README.md)

***

[barf](../../../../../README.md) / [core/issue/providers/github](../README.md) / GitHubIssueProvider

# Class: GitHubIssueProvider

Defined in: src/core/issue/providers/github.ts:71

GitHub Issues provider. Maps the barf state machine to GitHub labels (`barf:*`).

**Prerequisites:** The `gh` CLI must be authenticated (`gh auth login`).

**Locking:** Uses a `barf:locked` label — not POSIX-atomic. Designed for
single-agent use; concurrent agents on the same repo may race.

**Deletion:** GitHub issues cannot be deleted via the API. `deleteIssue` returns
`err` — transition to `COMPLETED` instead.

**Testing:** Pass a `spawnFn` to inject a mock `gh` implementation in tests.
This avoids real network calls without `mock.module` process-global patching.

## Extends

- [`IssueProvider`](../../../base/classes/IssueProvider.md)

## Constructors

### Constructor

> **new GitHubIssueProvider**(`repo`, `spawnFn?`): `GitHubIssueProvider`

Defined in: src/core/issue/providers/github.ts:75

#### Parameters

##### repo

`string`

##### spawnFn?

[`SpawnFn`](../type-aliases/SpawnFn.md)

#### Returns

`GitHubIssueProvider`

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`constructor`](../../../base/classes/IssueProvider.md#constructor)

## Derived

### autoSelect()

> **autoSelect**(`mode`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \} \| `null`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:173

Selects the highest-priority available (unlocked) issue for the given mode.

Priority order per [AutoSelectMode](../../../base/type-aliases/AutoSelectMode.md):
- `plan`: NEW
- `build`: IN_PROGRESS → PLANNED → NEW

#### Parameters

##### mode

[`AutoSelectMode`](../../../base/type-aliases/AutoSelectMode.md)

Determines which states are considered and their priority order.

#### Returns

`ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \} \| `null`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` for the best candidate, `ok(null)` if no eligible unlocked issue exists,
  or `err(Error)` on I/O failure.

#### Inherited from

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`autoSelect`](../../../base/classes/IssueProvider.md#autoselect)

***

### checkAcceptanceCriteria()

> **checkAcceptanceCriteria**(`id`): `ResultAsync`\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:200

Checks whether all acceptance criteria checkboxes in the issue body are ticked.
Delegates parsing to [parseAcceptanceCriteria](../../../functions/parseAcceptanceCriteria.md).

#### Parameters

##### id

`string`

Issue to inspect.

#### Returns

`ResultAsync`\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(true)` if all criteria are checked (or the section is absent),
  `ok(false)` if any `- [ ]` item remains, or `err(Error)` if the issue cannot be fetched.

#### Inherited from

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`checkAcceptanceCriteria`](../../../base/classes/IssueProvider.md#checkacceptancecriteria)

***

### transition()

> **transition**(`id`, `to`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:151

Validates and applies a state transition.

Delegates validation to [validateTransition](../../../functions/validateTransition.md); writes the new state via
[writeIssue](../../../base/classes/IssueProvider.md#writeissue). Call this instead of patching `state` directly to preserve invariants.

#### Parameters

##### id

`string`

Issue whose state will change.

##### to

Target state; must be reachable from the current state per `VALID_TRANSITIONS`.

`"NEW"` | `"PLANNED"` | `"IN_PROGRESS"` | `"STUCK"` | `"SPLIT"` | `"COMPLETED"`

#### Returns

`ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` with the updated issue, `err(InvalidTransitionError)` if the move is illegal,
  or `err(Error)` on I/O failure.

#### Inherited from

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`transition`](../../../base/classes/IssueProvider.md#transition)

## I/O — Override in Provider

### createIssue()

> **createIssue**(`input`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:127

Creates a new issue with state `NEW`.

#### Parameters

##### input

`title` is required; `body` and `parent` are optional.

###### body?

`string`

###### parent?

`string`

###### title

`string`

#### Returns

`ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` with the persisted issue (including assigned id), `err(Error)` on I/O or API failure.

#### Example

```ts
const result = await provider.createIssue({ title: 'Fix login bug', body: '...' });
if (result.isErr()) logger.error({ err: result.error }, 'create failed');
```

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`createIssue`](../../../base/classes/IssueProvider.md#createissue)

***

### deleteIssue()

> **deleteIssue**(`_id`): `ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:201

Permanently deletes an issue.
GitHub provider always returns `err` — use `transition(id, 'COMPLETED')` there.

#### Parameters

##### \_id

`string`

#### Returns

`ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` on success, `err(Error)` on I/O failure or if deletion is unsupported.

#### Example

```ts
const result = await provider.deleteIssue('001');
if (result.isErr()) logger.warn({ err: result.error }, 'delete unsupported, transition instead');
```

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`deleteIssue`](../../../base/classes/IssueProvider.md#deleteissue)

***

### fetchIssue()

> **fetchIssue**(`id`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:114

Retrieves a single issue by ID.

#### Parameters

##### id

`string`

Issue identifier (e.g. `'001'` for local, GitHub issue number for github).

#### Returns

`ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` on success, `err(Error)` if the issue does not exist or cannot be read.

#### Example

```ts
const result = await provider.fetchIssue('001');
if (result.isErr()) logger.error({ err: result.error }, 'fetch failed');
```

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`fetchIssue`](../../../base/classes/IssueProvider.md#fetchissue)

***

### isLocked()

> **isLocked**(`id`): `ResultAsync`\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:237

Checks whether the issue is currently locked by any process.

#### Parameters

##### id

`string`

Issue to check.

#### Returns

`ResultAsync`\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(true)` if locked, `ok(false)` if not, `err(Error)` on I/O or API failure.

#### Example

```ts
const result = await provider.isLocked('001');
if (result.isOk() && result.value) logger.warn({ id: '001' }, 'issue is locked, skipping');
```

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`isLocked`](../../../base/classes/IssueProvider.md#islocked)

***

### listIssues()

> **listIssues**(`filter?`): `ResultAsync`\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:118

Lists all issues, optionally filtered by state.

#### Parameters

##### filter?

If `filter.state` is set, only issues in that state are returned.

###### state?

`"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`

#### Returns

`ResultAsync`\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue[])` on success, `err(Error)` on I/O or API failure.

#### Example

```ts
const result = await provider.listIssues({ state: 'NEW' });
if (result.isOk()) result.value.forEach(i => logger.info({ id: i.id }, 'found'));
```

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`listIssues`](../../../base/classes/IssueProvider.md#listissues)

***

### lockIssue()

> **lockIssue**(`id`, `_meta?`): `ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:207

Acquires an exclusive lock on the issue.

- `LocalIssueProvider`: `O_CREAT | O_EXCL` atomic file creation in `.barf/<id>.lock`
- `GitHubIssueProvider`: adds the `barf:locked` label (meta ignored)

#### Parameters

##### id

`string`

Issue to lock.

##### \_meta?

###### mode?

`"split"` \| `"plan"` \| `"build"`

#### Returns

`ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` on success, `err(Error)` if the issue is already locked.

#### Example

```ts
const result = await provider.lockIssue('001', { mode: 'build' });
if (result.isErr()) throw new Error('Already locked by another process');
```

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`lockIssue`](../../../base/classes/IssueProvider.md#lockissue)

***

### unlockIssue()

> **unlockIssue**(`id`): `ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:223

Releases the lock acquired by [lockIssue](../../../base/classes/IssueProvider.md#lockissue). Safe to call if not locked.

#### Parameters

##### id

`string`

Issue to unlock.

#### Returns

`ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` always — implementations must not return `err` for a no-op unlock.

#### Example

```ts
await provider.unlockIssue('001'); // safe even if not currently locked
```

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`unlockIssue`](../../../base/classes/IssueProvider.md#unlockissue)

***

### writeIssue()

> **writeIssue**(`id`, `fields`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/providers/github.ts:155

Patches an issue's fields. Implementations must write atomically.
The `id` field cannot be patched — it is excluded from `fields`.

#### Parameters

##### id

`string`

Issue to update.

##### fields

[`Partial`](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype)\<[`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)\<[`Issue`](../../../../../types/type-aliases/Issue.md), `"id"`\>\>

Subset of [Issue](../../../../../types/type-aliases/Issue.md) fields to overwrite; `id` is excluded.

#### Returns

`ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` with the full updated issue, `err(Error)` on I/O or API failure.

#### Example

```ts
const result = await provider.writeIssue('001', { title: 'Updated title' });
if (result.isErr()) logger.error({ err: result.error }, 'write failed');
```

#### Overrides

[`IssueProvider`](../../../base/classes/IssueProvider.md).[`writeIssue`](../../../base/classes/IssueProvider.md#writeissue)
