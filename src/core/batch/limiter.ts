/**
 * Async concurrency limiter (semaphore) for bounding parallel issue processing.
 *
 * Used by the build and auto commands to cap how many {@link runLoop} calls
 * execute simultaneously within a single process. Unlike slicing the candidate
 * list to `N` items, this approach discovers all candidates upfront and processes
 * them through a bounded pool — so when one finishes, the next starts immediately.
 *
 * @module Orchestration
 */

/**
 * A function that limits concurrency of async work.
 *
 * Call it with an async thunk; it returns when the thunk completes.
 * If the concurrency cap is reached, the call awaits a free slot.
 */
export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>

/**
 * Creates an async semaphore that limits concurrent execution.
 *
 * @param concurrency - Maximum number of tasks that may execute simultaneously.
 * @returns A {@link Limiter} function that wraps async thunks with bounded concurrency.
 */
export function createLimiter(concurrency: number): Limiter {
  let running = 0
  const queue: Array<() => void> = []

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (running >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    running++
    try {
      return await fn()
    } finally {
      running--
      queue.shift()?.()
    }
  }
}
