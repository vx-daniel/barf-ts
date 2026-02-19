# Code Patterns Rules

Consistent patterns improve maintainability and reduce bugs.

## TypeScript Strictness

### Rule: No `any` Type

The `any` type defeats TypeScript's purpose. Use `unknown` with type guards.

```typescript
// WRONG - Using any
function processData(data: any) {
  return data.value;  // No type safety
}

// WRONG - Type assertion without validation
function processData(data: unknown) {
  return (data as Device).name;  // Unsafe cast
}

// CORRECT - Zod validation
function processData(data: unknown): Device {
  return DeviceSchema.parse(data);  // Validated and typed
}

// CORRECT - Type guard
function isDevice(data: unknown): data is Device {
  return DeviceSchema.safeParse(data).success;
}

function processData(data: unknown): Device | null {
  if (isDevice(data)) {
    return data;  // TypeScript knows it's Device
  }
  return null;
}
```

### Rule: No @ts-ignore Without Justification

```typescript
// WRONG - Blanket ignore
// @ts-ignore
const result = someBadlyTypedFunction();

// CORRECT - If absolutely necessary, explain why
// @ts-expect-error - Third-party library has incorrect types, see issue #123
const result = someBadlyTypedFunction();

// BETTER - Fix the types or use proper typing
const result: ExpectedType = someBadlyTypedFunction() as ExpectedType;
```

### Rule: Explicit Return Types on Exported Functions

```typescript
// WRONG - Implicit return type
export function createDevice(data: CreateDeviceInput) {
  return db.insert(devices).values(data).returning();
}

// CORRECT - Explicit return type
export async function createDevice(data: CreateDeviceInput): Promise<Device> {
  const [device] = await db.insert(devices).values(data).returning();
  return device;
}
```



## Service Layer

### Rule: Business Logic in Services, Not Routes

Routes handle HTTP concerns. Services handle business logic.

```typescript
// CORRECT - Thin route, business logic in service
app.post('/devices', async (request) => {
  const device = await deviceService.create(request.organizationId, request.body);
  return reply.status(201).send(device);
});

// services/device.service.ts
export class DeviceService {
  async create(organizationId: string, input: CreateDeviceInput): Promise<Device> {
    // Validate business rules
    await this.validateDeviceQuota(organizationId);
    await this.validateUniqueName(organizationId, input.name);

    // Create device
    const device = await this.repo.create(input);

    // Side effects
    await this.eventBus.publish('device.created', device);

    return device;
  }
}

// WRONG - Business logic in route
app.post('/devices', async (request) => {
  // Check quota
  const count = await db.select({ count: sql`count(*)` })
    .from(devices)
    .where(eq(devices.organizationId, request.organizationId));

  if (count >= 100) {
    throw new Error('Device quota exceeded');
  }

  // Check name uniqueness
  const existing = await db.select()
    .from(devices)
    .where(and(
      eq(devices.organizationId, request.organizationId),
      eq(devices.name, request.body.name)
    ));

  if (existing.length > 0) {
    throw new Error('Device name already exists');
  }

  // Create device
  const [device] = await db.insert(devices).values({
    ...request.body,
    organizationId: request.organizationId
  }).returning();

  // Publish event
  await eventBus.publish('device.created', device);

  return reply.status(201).send(device);
});
```

## Error Handling

### Rule: Use Typed Error Classes

```typescript
// CORRECT - Typed errors
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super('VALIDATION_ERROR', message, 400);
  }
}

// Usage
throw new NotFoundError('Device not found');
throw new ValidationError('Invalid input', zodError.errors);

// WRONG - Generic errors
throw new Error('Device not found');  // No status code, no error code
```

### Rule: Handle Errors at Boundaries

```typescript
// CORRECT - Global error handler
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
      }
    });
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: error.errors,
      }
    });
  }

  // Unknown errors
  logger.error({ err: error }, 'Unhandled error');
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }
  });
});

// WRONG - Try-catch in every route
app.get('/devices/:id', async (request, reply) => {
  try {
    const device = await deviceService.getDevice(request.params.id);
    return device;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return reply.status(404).send({ error: error.message });
    }
    return reply.status(500).send({ error: 'Something went wrong' });
  }
});
```

## Async Patterns

### Rule: Always Await Promises

```typescript
// WRONG - Unhandled promise
app.post('/devices', async (request) => {
  const device = await deviceService.create(request.body);

  // Fire and forget - errors lost!
  eventBus.publish('device.created', device);

  return device;
});

// CORRECT - Await or handle explicitly
app.post('/devices', async (request) => {
  const device = await deviceService.create(request.body);

  // Option 1: Await
  await eventBus.publish('device.created', device);

  // Option 2: Explicit fire-and-forget with error handling
  eventBus.publish('device.created', device).catch(err => {
    logger.error({ err, deviceId: device.id }, 'Failed to publish event');
  });

  return device;
});
```

### Rule: Use Promise.all for Parallel Operations

```typescript
// WRONG - Sequential when parallel is possible
const devices = await deviceRepo.findAll();
const users = await userRepo.findAll();
const alarms = await alarmRepo.findAll();

// CORRECT - Parallel execution
const [devices, users, alarms] = await Promise.all([
  deviceRepo.findAll(),
  userRepo.findAll(),
  alarmRepo.findAll(),
]);
```

## Naming Conventions

### Rule: Consistent Naming

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `device-repository.ts` |
| Classes | PascalCase | `DeviceRepository` |
| Functions | camelCase | `createDevice` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Interfaces | PascalCase (no I prefix) | `Device`, not `IDevice` |
| Types | PascalCase | `CreateDeviceInput` |
| Zod schemas | PascalCase + Schema | `DeviceSchema` |

### Rule: Meaningful Names

```typescript
// WRONG - Unclear abbreviations
const d = await getD(id);
const usr = request.user;
const cb = (err) => {};

// CORRECT - Clear names
const device = await getDevice(id);
const currentUser = request.user;
const handleError = (error) => {};
```

## KISS (Keep It Simple)

### Rule: Readability Over Cleverness

Code is read far more often than it's written. Optimize for the reader.

```typescript
// WRONG - Clever one-liner
const status = devices.filter(d => d.active).length > 0 ? devices.some(d => d.error) ? 'degraded' : 'healthy' : 'offline';

// CORRECT - Clear and scannable
const activeDevices = devices.filter(device => device.active);
const hasErrors = activeDevices.some(device => device.error);

let status: 'healthy' | 'degraded' | 'offline';
if (activeDevices.length === 0) {
  status = 'offline';
} else if (hasErrors) {
  status = 'degraded';
} else {
  status = 'healthy';
}
```

### Rule: No Cryptic Shorthand

Avoid abbreviations, single-letter variables, and terse syntax that requires mental parsing.

```typescript
// WRONG - Cryptic shorthand
const r = await req.json();
const { d, u, o } = r;
const res = d?.m?.t ?? u?.p?.t ?? o?.c?.t;
arr.forEach((x, i) => x.idx = i);

// CORRECT - Explicit and readable
const requestBody = await request.json();
const { device, user, organization } = requestBody;
const timestamp = device?.metadata?.timestamp
  ?? user?.profile?.timestamp
  ?? organization?.config?.timestamp;
devices.forEach((device, index) => {
  device.sortIndex = index;
});
```

### Rule: Avoid Nested Ternaries

One ternary is fine. Nested ternaries are not.

```typescript
// WRONG - Nested ternaries
const message = error ? error.critical ? 'CRITICAL' : 'WARNING' : 'OK';
const icon = status === 'active' ? '✓' : status === 'pending' ? '⏳' : status === 'error' ? '✗' : '?';

// CORRECT - if/else or switch
let message: string;
if (!error) {
  message = 'OK';
} else if (error.critical) {
  message = 'CRITICAL';
} else {
  message = 'WARNING';
}

// CORRECT - Object lookup for simple mappings
const statusIcons = {
  active: '✓',
  pending: '⏳',
  error: '✗',
} as const;
const icon = statusIcons[status] ?? '?';
```

### Rule: Explicit Over Implicit

Don't rely on JavaScript's quirky implicit behaviors.

```typescript
// WRONG - Implicit type coercion
if (value) { ... }              // Fails on 0, '', false
if (array.length) { ... }       // Works but unclear intent
const num = +stringValue;       // Cryptic unary plus
const str = '' + value;         // Implicit toString

// CORRECT - Explicit checks
if (value !== null && value !== undefined) { ... }
if (array.length > 0) { ... }
const num = parseInt(stringValue, 10);  // Or Number(stringValue)
const str = String(value);

// CORRECT - Nullish checks when appropriate
if (value != null) { ... }  // Explicitly checking null/undefined only
```

### Rule: One Operation Per Line

Don't chain multiple side effects or hide logic in complex expressions.

```typescript
// WRONG - Multiple operations hidden in expression
users.push(currentUser = await fetchUser(id));
const result = (cache[key] = await computeExpensive(key));
items.splice(idx, 1)[0].deleted = true;

// CORRECT - Separate operations
currentUser = await fetchUser(id);
users.push(currentUser);

const result = await computeExpensive(key);
cache[key] = result;

const [removedItem] = items.splice(idx, 1);
removedItem.deleted = true;
```

## Constants and Magic Numbers

### Rule: No Hardcoded Magic Numbers

Numeric literals hide intent and prevent runtime configuration. Extract them to environment variables or config files.

```typescript
// WRONG - Magic numbers scattered in code
if (retryCount > 3) { ... }
const timeout = 30000;
if (devices.length >= 100) { ... }

// WRONG - Hardcoded constants (better, but still inflexible)
const MAX_RETRIES = 3;  // Can't change without redeploying

// CORRECT - Environment variables for operational values
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES ?? '3', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10);
const DEVICE_QUOTA_LIMIT = parseInt(process.env.DEVICE_QUOTA_LIMIT ?? '100', 10);

// CORRECT - Validated config object (preferred)
const ConfigSchema = z.object({
  maxRetries: z.coerce.number().min(1).max(10).default(3),
  requestTimeoutMs: z.coerce.number().min(1000).max(300000).default(30000),
  deviceQuotaLimit: z.coerce.number().min(1).default(100),
});

const config = ConfigSchema.parse({
  maxRetries: process.env.MAX_RETRIES,
  requestTimeoutMs: process.env.REQUEST_TIMEOUT_MS,
  deviceQuotaLimit: process.env.DEVICE_QUOTA_LIMIT,
});

if (retryCount > config.maxRetries) { ... }
```

### Rule: Exceptions - Acceptable Numeric Literals

```typescript
// ACCEPTABLE - Universally understood values
array.slice(0, 1);           // First element
index + 1;                   // Next index
percentage / 100;            // Percentage conversion

// ACCEPTABLE - Unit conversions (consider a utility for complex ones)
const hours = minutes / 60;
const kilobytes = bytes / 1024;

// STILL NEEDS CONFIG - Business logic values
// Even if "8" seems obvious for password length, it should be configurable
const minPasswordLength = config.minPasswordLength;  // Not hardcoded 8
```



## DRY (Don't Repeat Yourself)

### Rule: Extract When Logic Is Repeated 3+ Times

Duplicate logic creates maintenance burden and inconsistency risk. Extract when:
- Same logic appears in 3+ places
- Logic is non-trivial (>5 lines or involves business rules)
- Changes to one instance would require changing others

```typescript
// WRONG - Same validation in multiple places
async function createDevice(input: CreateDeviceInput) {
  if (input.name.length > 100) throw new ValidationError('Name too long');
  // ...
}

async function updateDevice(id: string, input: UpdateDeviceInput) {
  if (input.name && input.name.length > 100) throw new ValidationError('Name too long');
  // ...
}

// CORRECT - Centralized validation via Zod schema
const DeviceNameSchema = z.string().max(100, 'Name too long');

const CreateDeviceSchema = z.object({
  name: DeviceNameSchema,
  // ...
});

const UpdateDeviceSchema = z.object({
  name: DeviceNameSchema.optional(),
  // ...
});
```

### Rule: Prefer Composition Over Inheritance for Reuse

```typescript
// CORRECT - Composable utilities
const withOrganizationFilter = <T extends { organizationId: string }>(
  query: SQL,
  organizationId: string
) => and(query, eq(devices.organizationId, organizationId));

// CORRECT - Shared Zod schemas via composition
const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const DeviceSchema = BaseEntitySchema.extend({
  name: z.string(),
  status: z.enum(['active', 'inactive']),
});
```

### Rule: Don't Abstract Prematurely

The "Rule of Three" applies—don't extract until you see repetition:

```typescript
// WRONG - Premature abstraction for single use
function buildDeviceQuery(filters: DeviceFilters) {
  // Complex abstraction used in only one place
}

// CORRECT - Inline logic until pattern emerges
const devices = await db.select()
  .from(devices)
  .where(and(
    eq(devices.organizationId, organizationId),
    eq(devices.status, 'active')
  ));

// CORRECT - Extract after 3+ similar queries exist
class DeviceQueryBuilder {
  // Now justified by multiple consumers
}
```

### Rule: DRY Applies to Knowledge, Not Just Code

Identical code isn't always duplication—context matters:

```typescript
// NOT duplication - different domains, may evolve separately
const UserEmailSchema = z.string().email();
const DeviceContactEmailSchema = z.string().email();

// IS duplication - same business rule, should be shared
const MAX_NAME_LENGTH = 100;  // Used for users, devices, organizations
const NameSchema = z.string().max(MAX_NAME_LENGTH);
```

## Testing Patterns

### Rule: Test Behavior, Not Implementation

```typescript
// WRONG - Testing implementation details
it('should call db.insert with correct values', async () => {
  const spy = jest.spyOn(db, 'insert');
  await deviceService.create(input);
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({...}));
});

// CORRECT - Testing behavior
it('should create a device and return it', async () => {
  const device = await deviceService.create(input);

  expect(device).toMatchObject({
    name: input.name,
    type: input.type,
    organizationId: expect.any(String),
  });

  // Verify it's actually in the database
  const found = await deviceRepo.findById(device.id);
  expect(found).toEqual(device);
});
```

### Rule: Use Descriptive Test Names

```typescript
// WRONG - Vague test names
it('should work', () => {...});
it('test create', () => {...});

// CORRECT - Describes behavior and context
it('should create a device when given valid input', () => {...});
it('should throw ValidationError when name is empty', () => {...});
it('should return 404 when device does not exist', () => {...});
```

## Modern TypeScript Patterns

> See [typescript-advanced.md](./typescript-advanced.md) for advanced patterns: `satisfies`, `as const`, discriminated unions, branded types, template literal types, and type predicates.
