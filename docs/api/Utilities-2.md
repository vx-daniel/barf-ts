[**barf**](README.md)

***

[barf](modules.md) / Utilities

# Utilities

## Functions

### syncToResultAsync()

> **syncToResultAsync**\<`T`\>(`fn`): [`ResultAsync`](#)\<`T`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/utils/syncToResultAsync.ts:15

Wraps a synchronous function that may throw into a [ResultAsync](#).

Equivalent to `ResultAsync.fromPromise(Promise.resolve().then(fn), toError)`.
Use this instead of repeating that boilerplate for sync I/O in providers.

#### Type Parameters

##### T

`T`

#### Parameters

##### fn

() => `T`

Synchronous function whose return value becomes `ok(T)`.
  If `fn` throws, the thrown value is coerced via [toError](Utilities-3.md#toerror) into `err(Error)`.

#### Returns

[`ResultAsync`](#)\<`T`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(T)` on success, `err(Error)` if `fn` throws.
