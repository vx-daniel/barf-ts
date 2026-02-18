---
name: zod-schema
description: "Generate Zod 4 schemas from examples or requirements. Creates type-safe validation schemas that serve as single source of truth for types, validation, and API docs."
---

# Zod Schema Generator

## Overview

Generate Zod 4 schemas that serve as the single source of truth for TypeScript types, runtime validation, and OpenAPI documentation.

**Announce at start:** "Generating Zod schema using zod-schema skill."

**IMPORTANT:** This project requires Zod 4.x (not Zod 3.x).

## Zod 4 Breaking Changes

If migrating from Zod 3 or following older tutorials, these changes are critical:

### Error Customization

```typescript
// Zod 3 (deprecated)
z.string().min(1, { message: 'Required' });
z.string({ invalid_type_error: 'Must be string' });

// Zod 4 - use `error` parameter
z.string().min(1, { error: 'Required' });

// Dynamic error with context
z.string().min(5, {
  error: (ctx) => `Minimum ${ctx.minimum} characters required`
});
```

### Top-Level Validators (Preferred in Zod 4)

```typescript
// Zod 4 adds top-level versions - use these
z.email()           // instead of z.string().email()
z.uuid()            // instead of z.string().uuid()
z.url()             // instead of z.url()
z.iso.datetime()    // instead of z.iso.datetime()
z.base64()          // new in v4
z.nanoid()          // new in v4
z.cuid()            // new in v4
z.cuid2()           // new in v4
z.ulid()            // new in v4

// Chain after top-level for additional constraints
z.uuid().describe('Device ID').brand<'DeviceId'>()
```

### Object Methods

```typescript
// Zod 3
z.object({ name: z.string() }).strict()
z.object({ name: z.string() }).passthrough()

// Zod 4 - dedicated functions
z.strictObject({ name: z.string() })  // Rejects extra keys
z.looseObject({ name: z.string() })   // Allows extra keys
```

### Error Formatting

```typescript
// Zod 4 - top-level formatting functions
const result = Schema.safeParse(input);
if (!result.success) {
  z.flattenError(result.error)   // Flat structure for forms
  z.treeifyError(result.error)   // Nested structure
  z.prettifyError(result.error)  // Human-readable for logs
}
```

### Function Schemas

```typescript
// Zod 3
z.function().args(z.string(), z.number()).returns(z.boolean())

// Zod 4 - object syntax
z.function({
  input: [z.string(), z.number()],
  output: z.boolean()
})
```

### Records

```typescript
// Zod 3 - value schema only (key defaults to string)
z.record(z.number())

// Zod 4 - requires both key and value schema
z.record(z.string(), z.number())
```

## Primitives (Required)

Before defining any schema, check if primitives exist. See `.claude/rules/zod-primitives.md` for full spec.

### Import Primitives First

```typescript
import {
  UserIdSchema,
  OrganizationIdSchema,
  DeviceIdSchema,
  EmailSchema,
  UsernameSchema,
  NameSchema,
  DescriptionSchema,
} from '@/schemas/primitives';
```

### Available Primitives

**Identity** (`primitives/identity.ts`):
- `UserIdSchema`, `OrganizationIdSchema`, `DeviceIdSchema`, `AlarmIdSchema`, `SessionIdSchema`
- All use `.brand<'TypeName'>()` for compile-time ID safety

**User Fields** (`primitives/user-fields.ts`):
- `UsernameSchema` - 3-30 chars, alphanumeric + `_-`
- `EmailSchema` - valid email, lowercase transform
- `PasswordSchema` - 12+ chars, complexity requirements
- `DisplayNameSchema` - 1-100 chars, trimmed
- `PhoneSchema` - E.164 format, optional

**Constraints** (`primitives/constraints.ts`):
- `NameSchema` - 1-255 chars, trimmed
- `ShortNameSchema` - 1-100 chars, trimmed
- `DescriptionSchema` - max 2000, optional
- `SlugSchema` - lowercase alphanumeric with hyphens
- `UrlSchema`, `HttpsUrlSchema`
- `TimestampSchema` - coerced date

### When to Create New Primitives

1. Same pattern appears 2+ times across schemas
2. Field represents common concept (IDs, names, emails, URLs)
3. Validation logic is non-trivial (regex, transforms)

Add to `primitives/` with `.describe()`, export from barrel.

## Schema Patterns

### Entity Schema

```typescript
// src/schemas/entities/device.schema.ts
import { z } from 'zod';
import {
  DeviceIdSchema,
  OrganizationIdSchema,
  NameSchema,
  DescriptionSchema,
  TimestampSchema,
} from '@/schemas/primitives';

// Base entity schema with all fields
export const DeviceSchema = z.object({
  // Use primitives for common fields
  id: DeviceIdSchema,
  organizationId: OrganizationIdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  // Domain-specific fields defined inline
  type: z.enum(['sensor', 'gateway', 'actuator']).describe('Device category'),
  status: z.enum(['active', 'inactive', 'offline', 'disabled']).describe('Current device status'),
  metadata: z.record(z.unknown()).optional().describe('Custom device attributes'),
  lastSeenAt: z.iso.datetime().nullable().describe('Last communication timestamp'),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

// Type inference (NEVER define types separately)
export type Device = z.infer<typeof DeviceSchema>;

// Create schema (omit auto-generated fields)
export const CreateDeviceSchema = DeviceSchema.omit({
  id: true,
  organizationId: true, // Injected from JWT
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateDevice = z.infer<typeof CreateDeviceSchema>;

// Update schema (all fields optional)
export const UpdateDeviceSchema = CreateDeviceSchema.partial();

export type UpdateDevice = z.infer<typeof UpdateDeviceSchema>;

// Response schema (for API docs)
export const DeviceResponseSchema = DeviceSchema;

// List response with pagination
export const DeviceListResponseSchema = z.object({
  data: z.array(DeviceSchema),
  pagination: z.object({
    nextCursor: z.string().nullable(),
    prevCursor: z.string().nullable(),
    hasMore: z.boolean(),
    total: z.number().int().optional(),
  }),
});
```

### Request Schemas

```typescript
// Path parameters - use top-level validators
export const DeviceParamsSchema = z.object({
  id: z.uuid().describe('Device ID'),
});

export const OrganizationDeviceParamsSchema = z.object({
  organizationId: z.uuid().describe('Organization ID'),
  deviceId: z.uuid().describe('Device ID'),
});

// Query parameters
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20).describe('Items per page'),
  cursor: z.string().optional().describe('Pagination cursor'),
  sort: z.enum(['asc', 'desc']).default('desc').describe('Sort direction'),
});

export const DeviceFilterQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['active', 'inactive', 'offline', 'disabled']).optional().describe('Filter by status'),
  type: z.enum(['sensor', 'gateway', 'actuator']).optional().describe('Filter by type'),
  search: z.string().max(100).optional().describe('Search by name'),
});
```

### Error Schemas

```typescript
// Standard error response
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().describe('Machine-readable error code'),
    message: z.string().describe('Human-readable error message'),
    details: z.array(z.object({
      field: z.string().optional().describe('Field that caused the error'),
      message: z.string().describe('Detail message'),
      code: z.string().optional().describe('Detail error code'),
    })).optional().describe('Validation error details'),
    requestId: z.uuid().optional().describe('Request ID for support'),
    timestamp: z.iso.datetime().optional().describe('Error timestamp'),
  }),
});

// Specific error schemas for OpenAPI
export const NotFoundErrorSchema = z.object({
  error: z.object({
    code: z.literal('NOT_FOUND'),
    message: z.string(),
    requestId: z.uuid().optional(),
  }),
});

export const ValidationErrorSchema = z.object({
  error: z.object({
    code: z.literal('VALIDATION_ERROR'),
    message: z.string(),
    details: z.array(z.object({
      field: z.string(),
      message: z.string(),
    })),
    requestId: z.uuid().optional(),
  }),
});

export const UnauthorizedErrorSchema = z.object({
  error: z.object({
    code: z.literal('UNAUTHORIZED'),
    message: z.string(),
    requestId: z.uuid().optional(),
  }),
});
```

### Telemetry Schemas

```typescript
// Telemetry data point
export const TelemetryPointSchema = z.object({
  timestamp: z.iso.datetime().describe('Measurement timestamp'),
  values: z.record(z.number()).describe('Metric name to value mapping'),
});

// Telemetry submission (from device)
export const TelemetrySubmitSchema = z.object({
  deviceId: z.uuid().describe('Source device ID'),
  points: z.array(TelemetryPointSchema).min(1).max(1000).describe('Data points'),
});

// Telemetry query
export const TelemetryQuerySchema = z.object({
  deviceId: z.uuid().describe('Device to query'),
  metrics: z.array(z.string()).optional().describe('Specific metrics to retrieve'),
  startTime: z.iso.datetime().describe('Query start time'),
  endTime: z.iso.datetime().describe('Query end time'),
  aggregation: z.enum(['none', 'avg', 'min', 'max', 'sum']).default('none'),
  interval: z.enum(['1m', '5m', '15m', '1h', '1d']).optional(),
});
```

### Config Schema Pattern

```typescript
// Environment configuration with validation
export const ConfigSchema = z.object({
  // Server
  port: z.coerce.number().min(1).max(65535).default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  databaseUrl: z.url().describe('PostgreSQL connection string'),

  // Auth
  jwtSecret: z.string().min(32).describe('JWT signing secret'),
  accessTokenExpiryMinutes: z.coerce.number().default(15),
  refreshTokenExpiryDays: z.coerce.number().default(7),

  // Limits
  maxRetries: z.coerce.number().min(1).max(10).default(3),
  requestTimeoutMs: z.coerce.number().default(30000),
  deviceQuotaLimit: z.coerce.number().default(100),

  // MQTT
  mqttBrokerUrl: z.url().optional(),
  awsIotEndpoint: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

// Parse and validate config
export const config = ConfigSchema.parse({
  port: process.env.PORT,
  host: process.env.HOST,
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  // ... etc
});
```

## Zod 4 Features to Use

### Refinements

```typescript
const PasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .refine((val) => /[A-Z]/.test(val), 'Must contain uppercase')
  .refine((val) => /[a-z]/.test(val), 'Must contain lowercase')
  .refine((val) => /[0-9]/.test(val), 'Must contain number')
  .refine((val) => /[^A-Za-z0-9]/.test(val), 'Must contain special character');
```

### Transforms

```typescript
const DateStringSchema = z.string()
  .datetime()
  .transform((val) => new Date(val));

const TrimmedStringSchema = z.string()
  .transform((val) => val.trim());
```

### Discriminated Unions

```typescript
const EventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('device.created'),
    payload: DeviceSchema,
  }),
  z.object({
    type: z.literal('device.updated'),
    payload: z.object({
      id: z.uuid(),  // Top-level validator
      changes: UpdateDeviceSchema,
    }),
  }),
  z.object({
    type: z.literal('device.deleted'),
    payload: z.object({
      id: z.uuid(),  // Top-level validator
    }),
  }),
]);
```

### Coercion

```typescript
// For query parameters (always strings)
const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  enabled: z.coerce.boolean().default(true),
});
```

### Number Validators (Zod 4)

```typescript
z.number()    // Any number (rejects NaN, Infinity in v4)
z.int()       // Integer only
z.int32()     // Signed 32-bit integer
z.uint32()    // Unsigned 32-bit integer
z.int64()     // BigInt 64-bit
z.float32()   // 32-bit float
z.float64()   // 64-bit float (alias for z.number())

// Use for stricter validation
const PortSchema = z.uint32().max(65535).describe('Port number');
const LatitudeSchema = z.float64().min(-90).max(90);
```

## Error Handling

### `.safeParse()` vs `.parse()`

```typescript
// USE .safeParse() for external/user input (doesn't throw)
const result = CreateDeviceSchema.safeParse(request.body);
if (!result.success) {
  const formatted = z.flattenError(result.error);
  return reply.status(400).send({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: Object.entries(formatted.fieldErrors).map(([field, msgs]) => ({
        field,
        message: msgs?.[0] ?? 'Invalid value',
      })),
    },
  });
}
const validatedData = result.data;  // Fully typed

// USE .parse() only for trusted/internal data (throws on failure)
const config = ConfigSchema.parse(process.env);  // Fail fast on startup
```

### ZodError Structure

```typescript
// error.issues array contains detailed info
{
  code: 'too_small',      // Error type
  path: ['devices', 0, 'name'],  // Location in nested structure
  message: 'Name required',
  minimum: 1,
  inclusive: true,
}

// Common issue codes
'invalid_type'     // Wrong type
'too_small'        // Below min
'too_big'          // Above max
'invalid_string'   // Failed string validation (email, uuid, etc.)
'custom'           // From .refine()
```

### Async Validation

```typescript
const UniqueEmailSchema = z.email().refine(
  async (email) => {
    const exists = await userRepo.existsByEmail(email);
    return !exists;
  },
  { message: 'Email already registered' }
);

// Must use .parseAsync() or .safeParseAsync()
const result = await UniqueEmailSchema.safeParseAsync(input);
```

## Checklist

- [ ] All schemas use Zod 4.x syntax
- [ ] **Common fields use primitives** (IDs, email, username, name, etc.)
- [ ] **No inline `z.string().uuid()` or `z.string().email()`** - use primitives
- [ ] Repeated patterns (2+) extracted to new primitives
- [ ] Every field has `.describe()` for API docs
- [ ] Types inferred with `z.infer<typeof Schema>` (never defined separately)
- [ ] CreateSchema omits auto-generated fields (id, timestamps)
- [ ] UpdateSchema uses `.partial()` for optional fields
- [ ] Query parameters use `z.coerce` for type conversion
- [ ] Error schemas follow project standard format
- [ ] Config schemas validate environment variables
- [ ] Use `.safeParse()` for user input, `.parse()` for trusted data
- [ ] Use top-level validators (`z.uuid()`, `z.email()`) where possible

## Migration from Zod 3

If converting existing Zod 3 code:

### Codemod (Automated)

```bash
npx zod-v3-to-v4
```

Review automated changes carefully - some may need manual adjustment.

### Quick Reference

| Zod 3 | Zod 4 |
|-------|-------|
| `{ message: '...' }` | `{ error: '...' }` |
| `{ invalid_type_error: '...' }` | `{ error: (ctx) => ... }` |
| `z.string().email()` | `z.email()` (preferred) |
| `z.string().uuid()` | `z.uuid()` (preferred) |
| `z.url()` | `z.url()` (preferred) |
| `.strict()` | `z.strictObject()` |
| `.passthrough()` | `z.looseObject()` |
| `z.record(valueSchema)` | `z.record(keySchema, valueSchema)` |
| `.args().returns()` | `{ input: [...], output: ... }` |
| `error.flatten()` | `z.flattenError(error)` |

### Official Resources

- [Zod 4 Announcement](https://zod.dev/v4)
- [Migration Guide](https://zod.dev/v4/changelog)
