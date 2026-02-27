import { describe, expect, it } from 'bun:test'
import { createLimiter } from '@/core/batch/limiter'

describe('createLimiter', () => {
  it('should allow up to N concurrent tasks', async () => {
    const limiter = createLimiter(2)
    let running = 0
    let maxRunning = 0

    const task = () =>
      limiter(async () => {
        running++
        maxRunning = Math.max(maxRunning, running)
        await new Promise((r) => setTimeout(r, 50))
        running--
      })

    await Promise.all([task(), task(), task(), task(), task()])

    expect(maxRunning).toBe(2)
  })

  it('should return the value from the wrapped function', async () => {
    const limiter = createLimiter(1)
    const result = await limiter(async () => 42)
    expect(result).toBe(42)
  })

  it('should release slot on error', async () => {
    const limiter = createLimiter(1)

    // First task errors
    await expect(
      limiter(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    // Second task should still work (slot was released)
    const result = await limiter(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('should process all tasks even with concurrency of 1', async () => {
    const limiter = createLimiter(1)
    const results: number[] = []

    await Promise.all(
      [1, 2, 3].map((n) =>
        limiter(async () => {
          results.push(n)
        }),
      ),
    )

    expect(results).toHaveLength(3)
  })

  it('should respect higher concurrency limits', async () => {
    const limiter = createLimiter(10)
    let running = 0
    let maxRunning = 0

    const tasks = Array.from({ length: 10 }, () =>
      limiter(async () => {
        running++
        maxRunning = Math.max(maxRunning, running)
        await new Promise((r) => setTimeout(r, 10))
        running--
      }),
    )

    await Promise.all(tasks)
    expect(maxRunning).toBe(10)
  })
})
