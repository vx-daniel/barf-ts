import { describe, it, expect } from 'bun:test'
import { AuditResponseSchema } from '@/types/schema/audit-schema'

describe('AuditResponseSchema', () => {
  it('parses a passing audit response', () => {
    const result = AuditResponseSchema.safeParse({ pass: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ pass: true })
    }
  })

  it('parses a failing audit response with findings', () => {
    const input = {
      pass: false,
      findings: [
        {
          category: 'failing_check',
          severity: 'error',
          title: 'Tests failing',
          detail: 'Unit tests have 3 failures'
        },
        {
          category: 'rule_violation',
          severity: 'warning',
          title: 'Missing TSDoc',
          detail: 'Exported function lacks doc comment'
        }
      ]
    }
    const result = AuditResponseSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.pass).toBe(false)
      if (!result.data.pass) {
        expect(result.data.findings).toHaveLength(2)
      }
    }
  })

  it('rejects pass=false with empty findings array', () => {
    const result = AuditResponseSchema.safeParse({ pass: false, findings: [] })
    expect(result.success).toBe(false)
  })

  it('rejects pass=false without findings field', () => {
    const result = AuditResponseSchema.safeParse({ pass: false })
    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = AuditResponseSchema.safeParse({
      pass: false,
      findings: [{ category: 'unknown', severity: 'error', title: 'x', detail: 'y' }]
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid severity', () => {
    const result = AuditResponseSchema.safeParse({
      pass: false,
      findings: [{ category: 'failing_check', severity: 'critical', title: 'x', detail: 'y' }]
    })
    expect(result.success).toBe(false)
  })

  it('rejects extra fields on pass=true gracefully', () => {
    // Zod strips extra fields by default
    const result = AuditResponseSchema.safeParse({ pass: true, extra: 'stuff' })
    expect(result.success).toBe(true)
  })
})
