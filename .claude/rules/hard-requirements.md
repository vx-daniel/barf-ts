# Hard Requirements

These requirements are **non-negotiable**. Violations must be flagged and corrected immediately.

## Technology Versions

### Zod 4.x (MANDATORY)

**Rule**: All schema validation MUST use Zod ^4.0.0. Zod 3.x is prohibited.

```typescript
// CORRECT
import { z } from 'zod';  // version ^4.0.0

// WRONG - Do not use Zod 3
import { z } from 'zod';  // version ^3.x.x
```

**Enforcement**:

- Check `package.json` for `"zod": "^4.0.0"`
- Flag any import of Zod without version verification
- All schemas must use Zod (no Joi, Yup, or manual validation)

### TypeScript 5.7+ Strict Mode (MANDATORY)

**Rule**: TypeScript must be 5.7+ with strict mode enabled.

**Enforcement**:

- `tsconfig.json` must have `"strict": true`
- No `any` types allowed (use `unknown` + type guards)
- No `@ts-ignore` or `@ts-expect-error` without justification comment

```typescript
// WRONG
const data: any = response.body;

// CORRECT
const data: unknown = response.body;
const parsed = DeviceSchema.parse(data);  // Zod validates and types
```

## Schema-First Development

**Rule**: Zod schemas are the single source of truth. Never define types separately.

```typescript
// CORRECT - Types derived from schema
const DeviceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
});
type Device = z.infer<typeof DeviceSchema>;

// WRONG - Separate type definition
interface Device {
  id: string;
  organizationId: string;
  name: string;
}
```

**Enforcement**:

- All API request/response types must come from Zod schemas
- All database entity types must align with Drizzle schema inference
- Frontend form validation must use the same Zod schemas as backend

## Violation Response

When a hard requirement violation is detected:

1. **Stop** - Do not proceed with the current task
2. **Flag** - Clearly identify the violation
3. **Fix** - Correct the violation before continuing
4. **Verify** - Ensure the fix meets the requirement
