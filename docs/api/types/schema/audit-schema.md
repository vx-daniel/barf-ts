[**barf**](../../README.md)

***

[barf](../../modules.md) / types/schema/audit-schema

# types/schema/audit-schema

## Audit

### AuditCategorySchema

> `const` **AuditCategorySchema**: `ZodEnum`\<[`AuditCategory`](#auditcategory)\>

Defined in: src/types/schema/audit-schema.ts:8

Categories of audit findings produced by the AI review phase.

***

### AuditFindingSchema

> `const` **AuditFindingSchema**: `ZodObject`\<[`AuditFinding`](#auditfinding)\>

Defined in: src/types/schema/audit-schema.ts:31

A single audit finding reported by the AI reviewer.

***

### AuditResponseSchema

> `const` **AuditResponseSchema**: `ZodDiscriminatedUnion`\<[`AuditResponse`](#auditresponse)\>

Defined in: src/types/schema/audit-schema.ts:49

Structured response from the AI audit review.

Discriminated on `pass`:
- `{ pass: true }` — audit passed, no issues found
- `{ pass: false, findings: [...] }` — audit failed with at least one finding

***

### AuditSeveritySchema

> `const` **AuditSeveritySchema**: `ZodEnum`\<[`AuditSeverity`](#auditseverity)\>

Defined in: src/types/schema/audit-schema.ts:22

Severity levels for audit findings.

## Other

### AuditCategory

> **AuditCategory** = `"failing_check"` \| `"unmet_criteria"` \| `"rule_violation"` \| `"production_readiness"`

Defined in: src/types/schema/audit-schema.ts:15

A finding category. Derived from [AuditCategorySchema](#auditcategoryschema).

***

### AuditFinding

> **AuditFinding** = `object`

Defined in: src/types/schema/audit-schema.ts:38

A validated audit finding. Derived from [AuditFindingSchema](#auditfindingschema).

#### Type Declaration

##### category

> **category**: `"failing_check"` \| `"unmet_criteria"` \| `"rule_violation"` \| `"production_readiness"` = `AuditCategorySchema`

##### detail

> **detail**: `string`

##### severity

> **severity**: `"error"` \| `"warning"` = `AuditSeveritySchema`

##### title

> **title**: `string`

***

### AuditResponse

> **AuditResponse** = \{ `pass`: `true`; \} \| \{ `findings`: `object`[]; `pass`: `false`; \}

Defined in: src/types/schema/audit-schema.ts:57

A validated audit response. Derived from [AuditResponseSchema](#auditresponseschema).

***

### AuditSeverity

> **AuditSeverity** = `"error"` \| `"warning"`

Defined in: src/types/schema/audit-schema.ts:24

A finding severity. Derived from [AuditSeveritySchema](#auditseverityschema).
