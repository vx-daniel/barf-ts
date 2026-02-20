import { ResultAsync } from 'neverthrow'
import { toError } from '@/utils/toError'

/**
 * Wraps a synchronous function that may throw into a {@link ResultAsync}.
 *
 * Equivalent to `ResultAsync.fromPromise(Promise.resolve().then(fn), toError)`.
 * Use this instead of repeating that boilerplate for sync I/O in providers.
 *
 * @param fn - Synchronous function whose return value becomes `ok(T)`.
 *   If `fn` throws, the thrown value is coerced via {@link toError} into `err(Error)`.
 * @returns `ok(T)` on success, `err(Error)` if `fn` throws.
 */
export function syncToResultAsync<T>(fn: () => T): ResultAsync<T, Error> {
  return ResultAsync.fromPromise(Promise.resolve().then(fn), toError)
}
