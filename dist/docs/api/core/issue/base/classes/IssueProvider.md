[**barf**](../../../../README.md)

***

[barf](../../../../README.md) / [core/issue/base](../README.md) / IssueProvider

# Abstract Class: IssueProvider

Defined in: src/core/issue/base.ts:28

Abstract base for all barf issue storage backends.

Concrete implementations: `LocalIssueProvider`, `GitHubIssueProvider`.

To add a custom backend: extend this class and implement the eight abstract methods.
The `transition`, `autoSelect`, and `checkAcceptanceCriteria` methods are
provided and shared by all providers.

## Extended by

- [`GitHubIssueProvider`](../../providers/github/classes/GitHubIssueProvider.md)
- [`LocalIssueProvider`](../../providers/local/classes/LocalIssueProvider.md)

## Constructors

### Constructor

> **new IssueProvider**(): `IssueProvider`

#### Returns

`IssueProvider`

## Derived

### autoSelect()

> **autoSelect**(`mode`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \} \| `null`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:173

Selects the highest-priority available (unlocked) issue for the given mode.

Priority order per [AutoSelectMode](../type-aliases/AutoSelectMode.md):
- `plan`: NEW
- `build`: IN_PROGRESS → PLANNED → NEW

#### Parameters

##### mode

[`AutoSelectMode`](../type-aliases/AutoSelectMode.md)

Determines which states are considered and their priority order.

#### Returns

`ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \} \| `null`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` for the best candidate, `ok(null)` if no eligible unlocked issue exists,
  or `err(Error)` on I/O failure.

***

### checkAcceptanceCriteria()

> **checkAcceptanceCriteria**(`id`): `ResultAsync`\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:200

Checks whether all acceptance criteria checkboxes in the issue body are ticked.
Delegates parsing to [parseAcceptanceCriteria](../../functions/parseAcceptanceCriteria.md).

#### Parameters

##### id

`string`

Issue to inspect.

#### Returns

`ResultAsync`\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(true)` if all criteria are checked (or the section is absent),
  `ok(false)` if any `- [ ]` item remains, or `err(Error)` if the issue cannot be fetched.

***

### transition()

> **transition**(`id`, `to`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:151

Validates and applies a state transition.

Delegates validation to [validateTransition](../../functions/validateTransition.md); writes the new state via
[writeIssue](#writeissue). Call this instead of patching `state` directly to preserve invariants.

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

## I/O — Override in Provider

### createIssue()

> `abstract` **createIssue**(`input`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:65

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

***

### deleteIssue()

> `abstract` **deleteIssue**(`id`): `ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:96

Permanently deletes an issue.
GitHub provider always returns `err` — use `transition(id, 'COMPLETED')` there.

#### Parameters

##### id

`string`

Issue to delete.

#### Returns

`ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(void)` on success, `err(Error)` on I/O failure or if deletion is unsupported.

#### Example

```ts
const result = await provider.deleteIssue('001');
if (result.isErr()) logger.warn({ err: result.error }, 'delete unsupported, transition instead');
```

***

### fetchIssue()

> `abstract` **fetchIssue**(`id`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:41

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

***

### isLocked()

> `abstract` **isLocked**(`id`): `ResultAsync`\<`boolean`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:135

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

***

### listIssues()

> `abstract` **listIssues**(`filter?`): `ResultAsync`\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:53

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

***

### lockIssue()

> `abstract` **lockIssue**(`id`, `meta?`): `ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:112

Acquires an exclusive lock on the issue.

- `LocalIssueProvider`: `O_CREAT | O_EXCL` atomic file creation in `.barf/<id>.lock`
- `GitHubIssueProvider`: adds the `barf:locked` label (meta ignored)

#### Parameters

##### id

`string`

Issue to lock.

##### meta?

Optional metadata written into the lock record.

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

***

### unlockIssue()

> `abstract` **unlockIssue**(`id`): `ResultAsync`\<`void`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:123

Releases the lock acquired by [lockIssue](#lockissue). Safe to call if not locked.

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

***

### writeIssue()

> `abstract` **writeIssue**(`id`, `fields`): `ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/core/issue/base.ts:83

Patches an issue's fields. Implementations must write atomically.
The `id` field cannot be patched — it is excluded from `fields`.

#### Parameters

##### id

`string`

Issue to update.

##### fields

[`Partial`](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype)\<[`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)\<[`Issue`](../../../../types/type-aliases/Issue.md), `"id"`\>\>

Subset of [Issue](../../../../types/type-aliases/Issue.md) fields to overwrite; `id` is excluded.

#### Returns

`ResultAsync`\<\{ `body`: `string`; `children`: `string`[]; `id`: `string`; `parent`: `string`; `split_count`: `number`; `state`: `"NEW"` \| `"PLANNED"` \| `"IN_PROGRESS"` \| `"STUCK"` \| `"SPLIT"` \| `"COMPLETED"`; `title`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(Issue)` with the full updated issue, `err(Error)` on I/O or API failure.

#### Example

```ts
const result = await provider.writeIssue('001', { title: 'Updated title' });
if (result.isErr()) logger.error({ err: result.error }, 'write failed');
```
