import { describe, it, expect } from 'bun:test'
import { ExecResultSchema } from '@/types/schema/exec-schema'

describe('ExecResultSchema', () => {
  it('parses a successful exec result', () => {
    const input = { stdout: 'hello', stderr: '', status: 0 }
    const result = ExecResultSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(input)
    }
  })

  it('parses a failed exec result', () => {
    const input = { stdout: '', stderr: 'error: not found', status: 1 }
    const result = ExecResultSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe(1)
    }
  })

  it('rejects missing stdout', () => {
    expect(
      ExecResultSchema.safeParse({ stderr: '', status: 0 }).success
    ).toBe(false)
  })

  it('rejects missing status', () => {
    expect(
      ExecResultSchema.safeParse({ stdout: '', stderr: '' }).success
    ).toBe(false)
  })
})
