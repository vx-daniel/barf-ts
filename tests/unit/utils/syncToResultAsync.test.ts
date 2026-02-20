import { describe, it, expect } from 'bun:test'
import { syncToResultAsync } from '@/utils/syncToResultAsync'

describe('syncToResultAsync', () => {
  it('returns ok when the function succeeds', async () => {
    const result = await syncToResultAsync(() => 42)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(42)
  })

  it('returns err when the function throws an Error', async () => {
    const result = await syncToResultAsync(() => {
      throw new Error('boom')
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe('boom')
  })

  it('coerces non-Error throws into Error', async () => {
    const result = await syncToResultAsync(() => {
      throw 'string error'
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error)
    expect(result._unsafeUnwrapErr().message).toBe('string error')
  })
})
