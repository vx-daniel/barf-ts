# Zod Primitives Rules

Reusable schema primitives ensure consistency and single-source-of-truth for common field types.

## File Structure

```
src/schemas/
├── primitives/
│   ├── index.ts          # Re-exports all primitives + types
│   ├── identity.ts       # Branded ID schemas
│   ├── user-fields.ts    # Username, email, password, displayName
│   └── constraints.ts    # Name, description, slug, url
├── entities/             # Entity schemas using primitives
├── requests/             # Request/query schemas
└── errors/               # Error response schemas
```

## Required Primitives

### Rule: Use Primitives for Common Fields

All common fields MUST use primitives from `@/schemas/primitives`. Inline definitions are violations.

| Field Type | Primitive | Inline Definition |
|------------|-----------|-------------------|
| User ID | `UserIdSchema` | ❌ VIOLATION |
| Organization ID | `OrganizationIdSchema` | ❌ VIOLATION |
| Device ID | `DeviceIdSchema` | ❌ VIOLATION |
| Alarm ID | `AlarmIdSchema` | ❌ VIOLATION |
| Session ID | `SessionIdSchema` | ❌ VIOLATION |
| Username | `UsernameSchema` | ❌ VIOLATION |
| Email | `EmailSchema` | ❌ VIOLATION |
| Password | `PasswordSchema` | ❌ VIOLATION |
| Display name | `DisplayNameSchema` | ❌ VIOLATION |
| Phone | `PhoneSchema` | ❌ VIOLATION |
| Name (1-255) | `NameSchema` | ❌ VIOLATION |
| Short name (1-100) | `ShortNameSchema` | ❌ VIOLATION |
| Description | `DescriptionSchema` | ❌ VIOLATION |
| Slug | `SlugSchema` | ❌ VIOLATION |
| URL | `UrlSchema` / `HttpsUrlSchema` | ❌ VIOLATION |
| Timestamp | `TimestampSchema` | ❌ VIOLATION |

```typescript
// CORRECT - Using primitives
import { EmailSchema, NameSchema, UserIdSchema } from '@/schemas/primitives';

const UserSchema = z.object({
  id: UserIdSchema,
  email: EmailSchema,
  name: NameSchema,
});

// WRONG - Inline definition of common field
const UserSchema = z.object({
  id: z.string().uuid(),     // VIOLATION: Use UserIdSchema
  email: z.string().email(), // VIOLATION: Use EmailSchema
  name: z.string().max(255), // VIOLATION: Use NameSchema
});
```

## Identifying New Primitives

### Rule: Extract When Pattern Appears 2+ Times

When the SAME schema pattern appears in 2+ places, extract to primitives.

**Signals to Extract:**
- Same `.min()/.max()` constraints on similar fields
- Same `.regex()` pattern used across schemas
- Same `.refine()` or `.transform()` logic repeated
- Field names suggesting shared concept (`*Name`, `*Id`, `*Email`, `*Url`)

```typescript
// BEFORE - Same pattern in two schemas (VIOLATION)
const DeviceSchema = z.object({
  label: z.string().min(1).max(50).trim(),  // Repeated!
});
const AlarmSchema = z.object({
  label: z.string().min(1).max(50).trim(),  // Same pattern!
});

// AFTER - Extracted to primitive
// primitives/constraints.ts
export const LabelSchema = z.string()
  .min(1).max(50).trim()
  .describe('Short label for display');

// Schemas use primitive
const DeviceSchema = z.object({ label: LabelSchema });
const AlarmSchema = z.object({ label: LabelSchema });
```

## Primitive Definitions

### Identity Primitives (`primitives/identity.ts`)

Branded UUIDs prevent ID type mixups at compile time:

```typescript
// Use Zod 4 top-level z.uuid() with branding
export const UserIdSchema = z.uuid()
  .describe('Unique user identifier')
  .brand<'UserId'>();
export type UserId = z.infer<typeof UserIdSchema>;

export const OrganizationIdSchema = z.uuid()
  .describe('Organization identifier for multi-tenancy isolation')
  .brand<'OrganizationId'>();
export type OrganizationId = z.infer<typeof OrganizationIdSchema>;

export const DeviceIdSchema = z.uuid()
  .describe('Unique device identifier')
  .brand<'DeviceId'>();
export type DeviceId = z.infer<typeof DeviceIdSchema>;

export const AlarmIdSchema = z.uuid()
  .describe('Unique alarm identifier')
  .brand<'AlarmId'>();
export type AlarmId = z.infer<typeof AlarmIdSchema>;

export const SessionIdSchema = z.uuid()
  .describe('Session identifier for auth tracking')
  .brand<'SessionId'>();
export type SessionId = z.infer<typeof SessionIdSchema>;
```

### User Field Primitives (`primitives/user-fields.ts`)

```typescript
export const UsernameSchema = z.string()
  .min(3, { error: 'Username must be at least 3 characters' })
  .max(30, { error: 'Username cannot exceed 30 characters' })
  .regex(/^[a-zA-Z0-9_-]+$/, { error: 'Username can only contain letters, numbers, underscores, hyphens' })
  .describe('Unique username for login');
export type Username = z.infer<typeof UsernameSchema>;

export const EmailSchema = z.email({ error: 'Invalid email format' })
  .max(255, { error: 'Email cannot exceed 255 characters' })
  .transform(v => v.toLowerCase())
  .describe('Email address, normalized to lowercase');
export type Email = z.infer<typeof EmailSchema>;

export const PasswordSchema = z.string()
  .min(12, { error: 'Password must be at least 12 characters' })
  .regex(/[A-Z]/, { error: 'Password must contain uppercase letter' })
  .regex(/[a-z]/, { error: 'Password must contain lowercase letter' })
  .regex(/[0-9]/, { error: 'Password must contain number' })
  .regex(/[^A-Za-z0-9]/, { error: 'Password must contain special character' })
  .describe('User password meeting security requirements');
// Note: No type export - passwords shouldn't be passed around typed

export const DisplayNameSchema = z.string()
  .min(1, { error: 'Display name required' })
  .max(100, { error: 'Display name cannot exceed 100 characters' })
  .trim()
  .describe('Human-readable display name');
export type DisplayName = z.infer<typeof DisplayNameSchema>;

export const PhoneSchema = z.string()
  .regex(/^\+?[1-9]\d{1,14}$/, { error: 'Invalid phone number (E.164 format)' })
  .optional()
  .describe('Phone number in E.164 format');
export type Phone = z.infer<typeof PhoneSchema>;
```

### Constraint Primitives (`primitives/constraints.ts`)

```typescript
export const NameSchema = z.string()
  .min(1, { error: 'Name is required' })
  .max(255, { error: 'Name cannot exceed 255 characters' })
  .trim()
  .describe('Human-readable resource name');
export type Name = z.infer<typeof NameSchema>;

export const ShortNameSchema = z.string()
  .min(1, { error: 'Name is required' })
  .max(100, { error: 'Name cannot exceed 100 characters' })
  .trim()
  .describe('Short resource name (labels, tags)');
export type ShortName = z.infer<typeof ShortNameSchema>;

export const DescriptionSchema = z.string()
  .max(2000, { error: 'Description cannot exceed 2000 characters' })
  .trim()
  .optional()
  .describe('Optional resource description');
export type Description = z.infer<typeof DescriptionSchema>;

export const SlugSchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'Slug must be lowercase alphanumeric with hyphens' })
  .describe('URL-safe identifier');
export type Slug = z.infer<typeof SlugSchema>;

export const UrlSchema = z.url({ error: 'Invalid URL format' })
  .max(2048, { error: 'URL cannot exceed 2048 characters' })
  .describe('Valid URL');
export type Url = z.infer<typeof UrlSchema>;

export const HttpsUrlSchema = UrlSchema
  .refine(url => url.startsWith('https://'), { error: 'URL must use HTTPS' })
  .describe('HTTPS URL only');
export type HttpsUrl = z.infer<typeof HttpsUrlSchema>;

export const TimestampSchema = z.coerce.date()
  .describe('ISO 8601 timestamp');
export type Timestamp = z.infer<typeof TimestampSchema>;
```

## PR Checklist

Before submitting PR with Zod schemas:

- [ ] All common fields use existing primitives
- [ ] No inline `z.string().email()`, `z.string().uuid()`, etc. - use top-level validators
- [ ] Use `{ error: '...' }` not `{ message: '...' }` (Zod 4 syntax)
- [ ] Repeated patterns (2+) extracted to new primitives
- [ ] New primitives have `.describe()` documentation
- [ ] New primitives exported from barrel `primitives/index.ts`
- [ ] Types exported alongside schemas

## Violation Response

When primitive rule violated:

1. **Flag** - Identify inline common field or repeated pattern
2. **Extract** - Create primitive or use existing one
3. **Update** - Replace all inline occurrences
4. **Document** - Add `.describe()` to new primitives
5. **Export** - Add to barrel `primitives/index.ts`
