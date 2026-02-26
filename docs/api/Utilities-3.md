[**barf**](README.md)

***

[barf](modules.md) / Utilities

# Utilities

## Functions

### toError()

> **toError**(`e`): [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)

Defined in: src/utils/toError.ts:14

Coerces an unknown thrown value into a proper [Error](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error) instance.

JavaScript `catch` and `Promise.reject` can receive any type. This function
normalises the value so that `ResultAsync.fromPromise` error mappers and other
boundary code always work with `Error` objects.

#### Parameters

##### e

`unknown`

The caught value (may be a string, number, null, or anything).

#### Returns

[`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)

The original value if it is already an `Error`, otherwise a new `Error`
  whose message is `String(e)`.
