import { describe, it, expect } from 'bun:test'
import { toError } from '@/utils/toError'

describe('toError', () => {
  it('passes through Error instances unchanged', () => {
    const err = new Error('original')
    expect(toError(err)).toBe(err)
  })

  it('wraps a string in an Error', () => {
    const result = toError('something broke')
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('something broke')
  })

  it('wraps a number in an Error', () => {
    const result = toError(42)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('42')
  })

  it('wraps null in an Error', () => {
    const result = toError(null)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('null')
  })

  it('wraps undefined in an Error', () => {
    const result = toError(undefined)
    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('undefined')
  })

  it('preserves Error subclasses', () => {
    const err = new TypeError('bad type')
    expect(toError(err)).toBe(err)
    expect(toError(err)).toBeInstanceOf(TypeError)
  })
})
