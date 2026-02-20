/**
 * Coerces an unknown thrown value into a proper {@link Error} instance.
 *
 * JavaScript `catch` and `Promise.reject` can receive any type. This function
 * normalises the value so that `ResultAsync.fromPromise` error mappers and other
 * boundary code always work with `Error` objects.
 *
 * @param e - The caught value (may be a string, number, null, or anything).
 * @returns The original value if it is already an `Error`, otherwise a new `Error`
 *   whose message is `String(e)`.
 */
export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e))
}
