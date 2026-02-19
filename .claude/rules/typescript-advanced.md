# Advanced TypeScript Patterns

Advanced TypeScript patterns for type-safe, maintainable code. For core patterns (repository, service layer, error handling), see [code-patterns.md](./code-patterns.md).

## `satisfies` for Type Checking Without Widening

```typescript
// WRONG - Type annotation widens the type
const config: Record<string, string> = {
  apiUrl: 'https://api.example.com',
  timeout: '5000',
};
config.apiUrl;  // type: string (widened)

// CORRECT - satisfies validates but preserves literal types
const config = {
  apiUrl: 'https://api.example.com',
  timeout: '5000',
} satisfies Record<string, string>;
config.apiUrl;  // type: 'https://api.example.com' (preserved)
```

## `as const` for Immutable Literal Types

```typescript
// WRONG - Mutable array with wide type
const DEVICE_STATUSES = ['active', 'inactive', 'offline'];
// type: string[]

// CORRECT - Immutable tuple with literal types
const DEVICE_STATUSES = ['active', 'inactive', 'offline'] as const;
// type: readonly ['active', 'inactive', 'offline']

// Derive type from const
type DeviceStatus = typeof DEVICE_STATUSES[number];
// type: 'active' | 'inactive' | 'offline'

// CORRECT - Object literals
const ErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

## Discriminated Unions for State Management

```typescript
// WRONG - Optional properties create invalid states
interface ApiResponse<T> {
  data?: T;
  error?: string;
  loading?: boolean;
}

// CORRECT - Discriminated union prevents invalid states
type ApiResponse<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// Usage with exhaustive checking
function handleResponse<T>(response: ApiResponse<T>): T | null {
  switch (response.status) {
    case 'idle':
    case 'loading':
      return null;
    case 'success':
      return response.data;  // TypeScript knows data exists
    case 'error':
      throw new Error(response.error);
  }
}
```

## Exhaustive Checks with `never`

```typescript
type DeviceType = 'sensor' | 'gateway' | 'actuator';

function getDeviceIcon(type: DeviceType): string {
  switch (type) {
    case 'sensor':
      return 'thermometer';
    case 'gateway':
      return 'router';
    case 'actuator':
      return 'toggle';
    default:
      // If a new type is added, TypeScript will error here
      const _exhaustive: never = type;
      throw new Error(`Unhandled device type: ${_exhaustive}`);
  }
}
```

## Branded Types for Type-Safe IDs

Prevent mixing up IDs of different entity types:

```typescript
// WRONG - Easy to mix up string IDs
function getDevice(deviceId: string, organizationId: string): Device;
getDevice(organizationId, deviceId);  // Compiles but wrong!

// CORRECT - Branded types prevent mixups
type Brand<T, B> = T & { __brand: B };

type DeviceId = Brand<string, 'DeviceId'>;
type OrganizationId = Brand<string, 'OrganizationId'>;

const createDeviceId = (id: string): DeviceId => id as DeviceId;
const createOrganizationId = (id: string): OrganizationId => id as OrganizationId;

function getDevice(deviceId: DeviceId, organizationId: OrganizationId): Device;

// Now TypeScript catches the error
getDevice(organizationId, deviceId);  // ERROR: Types don't match
```

## Template Literal Types for String Patterns

```typescript
// Type-safe event names
type EntityType = 'device' | 'user' | 'organization' | 'alarm';
type EventAction = 'created' | 'updated' | 'deleted';
type EventName = `${EntityType}.${EventAction}`;

function publishEvent(event: EventName, payload: unknown): void;

publishEvent('device.created', device);  // OK
publishEvent('device.moved', device);    // ERROR: not a valid event

// Type-safe cache keys
type CacheKey = `org:${string}:${EntityType}:${string}`;

function setCache(key: CacheKey, value: unknown): void;
setCache(`org:${organizationId}:device:${deviceId}`, device);  // OK
setCache(`device:${deviceId}`, device);  // ERROR: wrong format
```

## `readonly` for Immutable Data

```typescript
// Readonly parameters prevent mutation
function processDevices(devices: readonly Device[]): DeviceSummary {
  // devices.push(newDevice);  // ERROR: Cannot mutate
  return devices.reduce((summary, device) => /*...*/, {});
}

// Deep readonly for nested objects
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
```

## Nullish Coalescing and Optional Chaining

```typescript
// WRONG - Falsy check catches 0 and ''
const limit = options.limit || 20;  // 0 becomes 20!

// CORRECT - Nullish coalescing only checks null/undefined
const limit = options.limit ?? 20;  // 0 stays 0

// Optional chaining for nested access
const city = user?.address?.city ?? 'Unknown';

// Nullish assignment
user.preferences ??= {};  // Only assign if null/undefined
```

## Type Predicates for Custom Type Guards

```typescript
// Type predicate for runtime type checking
function isDevice(value: unknown): value is Device {
  return DeviceSchema.safeParse(value).success;
}

// Usage narrows the type
function process(data: unknown) {
  if (isDevice(data)) {
    console.log(data.id);  // TypeScript knows data is Device
  }
}

// Assertion function (throws on invalid)
function assertDevice(value: unknown): asserts value is Device {
  if (!DeviceSchema.safeParse(value).success) {
    throw new ValidationError('Invalid device');
  }
}
```

## Infer Types from Zod Schemas

> See [zod-primitives.md](./zod-primitives.md) for schema primitives.

```typescript
// WRONG - Manual type duplication
interface Device {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

// CORRECT - Infer type from schema
const DeviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  status: z.enum(['active', 'inactive', 'offline']),
});

type Device = z.infer<typeof DeviceSchema>;

// Input vs Output types
const CreateDeviceSchema = DeviceSchema.omit({ id: true });
type CreateDeviceInput = z.infer<typeof CreateDeviceSchema>;
```
