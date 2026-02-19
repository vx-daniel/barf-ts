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

## TSDoc Comments

Use **TSDoc** format (the TypeScript standard), not JSDoc closure style. Types are provided by the TypeScript signature — never repeat them in tags.

**Rule**: All exported symbols must have a `/** */` block comment explaining WHY/context, not just restating the signature.

**Rule**: `@param name - desc` (TSDoc style, no `{Type}` in the tag). Required when purpose is non-obvious from name and type alone.

**Rule**: `@returns` required for `Result`/`ResultAsync` — document both arms using backtick-formatted types: `` `ok(X)` on success, `err(Y)` if ... ``.

**Rule**: Extra context goes in the body text before tags. Do not use `@remarks` — it is not part of this codebase's convention.

**Rule**: Use `{@link SymbolName}` for cross-references to types, functions, or constants defined in this codebase. No display-text variant needed.

**Rule**: `@example` required on abstract methods to show call-site usage. Optional elsewhere.

**NOT required**: `@throws` (neverthrow — no thrown errors), `@typeParam` (generics are self-documenting from the signature), `@public`/`@internal` (TypeScript `export` handles visibility).

```typescript
// WRONG - JSDoc closure style (type annotation in tag)
/**
 * @param {Issue} issue - The issue
 * @returns {Result<Issue, Error>} the result
 */
export function transition(issue: Issue, next: IssueState): Result<Issue, AppError> { ... }

// WRONG - Restates the signature, adds no context
/** Transitions an issue to a new state. */
export function transition(issue: Issue, next: IssueState): Result<Issue, AppError> { ... }

// CORRECT - TSDoc style, explains WHY, documents both Result arms
/**
 * Validates and applies a state transition, enforcing the {@link VALID_TRANSITIONS} machine.
 * Call this instead of mutating `issue.state` directly to preserve invariants.
 *
 * @param issue - The issue whose state will change
 * @param next - Target state; must be reachable from `issue.state`
 * @returns `ok(issue)` with the updated state, or `err(InvalidTransitionError)` if the
 *   transition is not permitted from the current state
 */
export function transition(issue: Issue, next: IssueState): Result<Issue, AppError> { ... }

// CORRECT - Abstract method with @example
/**
 * Persists a new issue to the backing store.
 *
 * @param issue - Fully-constructed issue; id is assigned by the caller before this call
 * @returns `ok(issue)` on success, `err(Error)` on I/O failure
 * @example
 * const result = await provider.save(issue);
 * if (result.isErr()) logger.error({ err: result.error }, 'save failed');
 */
abstract save(issue: Issue): ResultAsync<Issue, Error>;
```

**Enforcement**:

- Every exported function, class, method, and type alias needs a `/** */` doc comment
- `@param {Type}` closure-style annotations are a violation — type comes from the signature
- `Result`/`ResultAsync` returns must document both arms using backtick formatting
- Abstract methods must include `@example`
- `{@link}` required when referencing a symbol defined in this codebase
- TypeDoc runs with `validation: { notExported: true, invalidLink: true }` — broken `{@link}` references are CI failures

## Violation Response

When a hard requirement violation is detected:

1. **Stop** - Do not proceed with the current task
2. **Flag** - Clearly identify the violation
3. **Fix** - Correct the violation before continuing
4. **Verify** - Ensure the fix meets the requirement
