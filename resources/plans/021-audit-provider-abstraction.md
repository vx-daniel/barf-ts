# Audit Provider Abstraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardwired OpenAI audit call with an `AuditProvider` abstract class, add `GeminiAuditProvider`, and wire everything through a factory so future providers need only one new file and one switch case.

**Architecture:** Abstract class `AuditProvider` in `src/providers/base.ts` defines the contract. `OpenAIAuditProvider` and `GeminiAuditProvider` extend it. `createAuditProvider(config)` in `src/providers/index.ts` selects the implementation. `audit.ts` calls `createAuditProvider` and uses `chatJSON` — the manual JSON.parse/safeParse block is gone.

**Tech Stack:** Bun, TypeScript strict, Zod 4, neverthrow (`ResultAsync`/`Result`), `openai` SDK (existing), `@google/generative-ai` SDK (new), `bun:test`

---

### Task 1: Create `provider-schema.ts` with shared schemas

Replace the OpenAI-specific schemas with provider-agnostic ones that all providers share.

**Files:**
- Create: `src/types/schema/provider-schema.ts`
- Create: `tests/unit/provider-schema.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/unit/provider-schema.test.ts
import { describe, it, expect } from 'bun:test'
import {
  TokenUsageSchema,
  ChatResultSchema,
  ChatOptionsSchema,
  PingResultSchema,
  ProviderInfoSchema,
} from '@/types/schema/provider-schema'

describe('TokenUsageSchema', () => {
  it('parses full usage', () => {
    const result = TokenUsageSchema.safeParse({ promptTokens: 10, completionTokens: 5, totalTokens: 15 })
    expect(result.success).toBe(true)
  })
  it('defaults all counts to 0 when missing', () => {
    const result = TokenUsageSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.promptTokens).toBe(0)
      expect(result.data.completionTokens).toBe(0)
      expect(result.data.totalTokens).toBe(0)
    }
  })
})

describe('ChatResultSchema', () => {
  it('parses valid result', () => {
    const result = ChatResultSchema.safeParse({
      content: 'hello', promptTokens: 5, completionTokens: 3, totalTokens: 8
    })
    expect(result.success).toBe(true)
  })
  it('rejects missing content', () => {
    expect(ChatResultSchema.safeParse({ promptTokens: 5, completionTokens: 3, totalTokens: 8 }).success).toBe(false)
  })
})

describe('ChatOptionsSchema', () => {
  it('parses empty options (all optional)', () => {
    expect(ChatOptionsSchema.safeParse({}).success).toBe(true)
  })
  it('parses temperature, maxTokens, jsonMode', () => {
    const result = ChatOptionsSchema.safeParse({ temperature: 0.5, maxTokens: 500, jsonMode: true })
    expect(result.success).toBe(true)
  })
})

describe('PingResultSchema', () => {
  it('parses latencyMs and model', () => {
    const result = PingResultSchema.safeParse({ latencyMs: 120, model: 'gpt-4o' })
    expect(result.success).toBe(true)
  })
  it('rejects missing latencyMs', () => {
    expect(PingResultSchema.safeParse({ model: 'gpt-4o' }).success).toBe(false)
  })
})

describe('ProviderInfoSchema', () => {
  it('parses a full provider info object', () => {
    const result = ProviderInfoSchema.safeParse({
      name: 'openai',
      displayName: 'OpenAI',
      requiredConfigKeys: ['openaiApiKey'],
      supportedModels: ['gpt-4o', 'gpt-4o-mini'],
    })
    expect(result.success).toBe(true)
  })
  it('rejects missing requiredConfigKeys', () => {
    expect(ProviderInfoSchema.safeParse({ name: 'openai', displayName: 'OpenAI', supportedModels: [] }).success).toBe(false)
  })
})
```

**Step 2: Run to verify they fail**

```bash
cd /path/to/barf-ts && bun test tests/unit/provider-schema.test.ts
```
Expected: `Cannot find module '@/types/schema/provider-schema'`

**Step 3: Implement `provider-schema.ts`**

```ts
// src/types/schema/provider-schema.ts
import { z } from 'zod'

/**
 * Intermediate token usage extracted by each provider's `parseResponse`.
 * All counts default to 0 — providers that omit usage data are safe.
 *
 * @category Providers
 */
export const TokenUsageSchema = z.object({
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  totalTokens: z.number().default(0),
})
/** Derived from {@link TokenUsageSchema}. */
export type TokenUsage = z.infer<typeof TokenUsageSchema>

/**
 * Canonical output returned by any {@link AuditProvider}'s `chat` method.
 * All callers depend on this shape, never on provider-specific response objects.
 *
 * @category Providers
 */
export const ChatResultSchema = z.object({
  content: z.string(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
})
/** Derived from {@link ChatResultSchema}. */
export type ChatResult = z.infer<typeof ChatResultSchema>

/**
 * Options accepted by `chat` and `chatJSON`. All fields are optional.
 * `jsonMode` enables provider-native structured JSON output (replaces the
 * old OpenAI-specific `responseFormat: { type: 'json_object' }` option).
 *
 * @category Providers
 */
export const ChatOptionsSchema = z.object({
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  jsonMode: z.boolean().optional(),
})
/** Derived from {@link ChatOptionsSchema}. */
export type ChatOptions = z.infer<typeof ChatOptionsSchema>

/**
 * Result returned by {@link AuditProvider.ping}.
 *
 * @category Providers
 */
export const PingResultSchema = z.object({
  latencyMs: z.number(),
  model: z.string(),
})
/** Derived from {@link PingResultSchema}. */
export type PingResult = z.infer<typeof PingResultSchema>

/**
 * Static metadata about a provider. Returned by {@link AuditProvider.describe}.
 * No network call required — used for error messages and config validation.
 *
 * @category Providers
 */
export const ProviderInfoSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  requiredConfigKeys: z.array(z.string()),
  supportedModels: z.array(z.string()),
})
/** Derived from {@link ProviderInfoSchema}. */
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>
```

**Step 4: Run to verify tests pass**

```bash
bun test tests/unit/provider-schema.test.ts
```
Expected: all 9 tests pass.

**Step 5: Commit**

```bash
git add src/types/schema/provider-schema.ts tests/unit/provider-schema.test.ts
git commit -m "feat: add provider-schema.ts with shared ChatResult, ChatOptions, PingResult, ProviderInfo"
```

---

### Task 2: Create `AuditProvider` abstract base class

**Files:**
- Create: `src/providers/base.ts`
- Create: `tests/unit/providers/base.test.ts`

**Step 1: Write the failing tests**

These tests use a `MockAuditProvider` stub to exercise the concrete methods on the abstract class (`chatJSON`, `normalizeResponse`). You never instantiate `AuditProvider` directly.

```ts
// tests/unit/providers/base.test.ts
import { describe, it, expect } from 'bun:test'
import { ok, err, ResultAsync } from 'neverthrow'
import { z } from 'zod'
import { AuditProvider } from '@/providers/base'
import type { ChatResult, ChatOptions, PingResult, ProviderInfo, TokenUsage } from '@/types/schema/provider-schema'
import type { Config } from '@/types'

// Minimal stub — only implements abstract methods
class MockAuditProvider extends AuditProvider {
  name = 'mock'
  private _chatContent: string
  private _chatErr: Error | null

  constructor(chatContent = '{"key":"value"}', chatErr: Error | null = null) {
    super()
    this._chatContent = chatContent
    this._chatErr = chatErr
  }

  describe(): ProviderInfo {
    return { name: 'mock', displayName: 'Mock', requiredConfigKeys: ['mockKey'], supportedModels: ['mock-model'] }
  }

  isConfigured(_config: Config): boolean { return true }

  ping(): ResultAsync<PingResult, Error> {
    return ResultAsync.fromPromise(Promise.resolve({ latencyMs: 10, model: 'mock-model' }), e => e as Error)
  }

  chat(_prompt: string, _opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    if (this._chatErr) return ResultAsync.fromPromise(Promise.reject(this._chatErr), e => e as Error)
    return ResultAsync.fromPromise(
      Promise.resolve({ content: this._chatContent, promptTokens: 5, completionTokens: 3, totalTokens: 8 }),
      e => e as Error
    )
  }

  protected parseResponse(_raw: unknown): ReturnType<AuditProvider['parseResponse']> {
    return ok({ content: 'parsed', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } })
  }
}

describe('AuditProvider.normalizeResponse', () => {
  it('trims content whitespace', () => {
    const provider = new MockAuditProvider()
    // Access protected method via cast for testing
    const result = (provider as unknown as { normalizeResponse: (r: { content: string; usage: TokenUsage }) => ChatResult })
      .normalizeResponse({ content: '  hello  ', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } })
    expect(result.content).toBe('hello')
  })

  it('defaults missing token counts to 0', () => {
    const provider = new MockAuditProvider()
    const result = (provider as unknown as { normalizeResponse: (r: { content: string; usage: TokenUsage }) => ChatResult })
      .normalizeResponse({ content: 'x', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } })
    expect(result.promptTokens).toBe(0)
    expect(result.completionTokens).toBe(0)
  })
})

describe('AuditProvider.chatJSON', () => {
  const Schema = z.object({ key: z.string() })

  it('returns parsed typed value when chat succeeds and JSON is valid', async () => {
    const provider = new MockAuditProvider('{"key":"value"}')
    const result = await provider.chatJSON('prompt', Schema)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.key).toBe('value')
    }
  })

  it('returns err when chat fails', async () => {
    const provider = new MockAuditProvider('{}', new Error('API down'))
    const result = await provider.chatJSON('prompt', Schema)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toBe('API down')
    }
  })

  it('returns err when response is not valid JSON', async () => {
    const provider = new MockAuditProvider('not json')
    const result = await provider.chatJSON('prompt', Schema)
    expect(result.isErr()).toBe(true)
  })

  it('returns err when JSON does not match schema', async () => {
    const provider = new MockAuditProvider('{"wrong":123}')
    const result = await provider.chatJSON('prompt', Schema)
    expect(result.isErr()).toBe(true)
  })
})
```

**Step 2: Run to verify they fail**

```bash
bun test tests/unit/providers/base.test.ts
```
Expected: `Cannot find module '@/providers/base'`

**Step 3: Implement `src/providers/base.ts`**

```ts
// src/providers/base.ts
import { Result, ok, err, ResultAsync } from 'neverthrow'
import type { ZodType } from 'zod'
import { toError } from '@/utils/toError'
import { createLogger } from '@/utils/logger'
import type { Config } from '@/types'
import type {
  ChatResult,
  ChatOptions,
  PingResult,
  ProviderInfo,
  TokenUsage,
} from '@/types/schema/provider-schema'

export type { ChatResult, ChatOptions, PingResult, ProviderInfo, TokenUsage }

const logger = createLogger('providers')

/**
 * Abstract base class for single-turn AI audit providers.
 *
 * Subclasses implement `chat`, `parseResponse`, `ping`, `describe`, and
 * `isConfigured`. The concrete methods `chatJSON` and `normalizeResponse`
 * are inherited and shared across all providers.
 *
 * @example
 * ```ts
 * const provider = createAuditProvider(config)
 * const result = await provider.chatJSON(prompt, AuditResponseSchema)
 * ```
 *
 * @category Providers
 */
export abstract class AuditProvider {
  /** Programmatic identifier used in config and logs (e.g. `'openai'`, `'gemini'`). */
  abstract readonly name: string

  /**
   * Returns static metadata about this provider.
   * No network call — safe to call before `isConfigured`.
   *
   * @returns Provider name, display name, required config keys, and supported models.
   */
  abstract describe(): ProviderInfo

  /**
   * Returns true if all required API keys are set in `config`.
   * Use this to short-circuit before making network calls.
   *
   * @param config - Loaded barf configuration.
   */
  abstract isConfigured(config: Config): boolean

  /**
   * Makes a minimal API call to verify connectivity and authentication.
   *
   * @returns `ok({ latencyMs, model })` on success, `err(Error)` on failure.
   */
  abstract ping(): ResultAsync<PingResult, Error>

  /**
   * Sends a single-turn prompt and returns the canonical {@link ChatResult}.
   *
   * @param prompt - The full prompt text to send.
   * @param opts - Optional temperature, max tokens, and JSON mode flag.
   * @returns `ok(ChatResult)` on success, `err(Error)` on API failure.
   */
  abstract chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error>

  /**
   * Extracts content and token usage from a provider-specific raw API response.
   * Called internally by `chat` implementations.
   *
   * @param raw - The raw response object from the provider SDK.
   * @returns `ok({ content, usage })` on success, `err(Error)` if the response shape is unexpected.
   */
  protected abstract parseResponse(
    raw: unknown
  ): Result<{ content: string; usage: TokenUsage }, Error>

  /**
   * Maps the intermediate `{ content, usage }` shape to barf's canonical {@link ChatResult}.
   * Trims content whitespace and zero-fills missing token counts.
   *
   * @param raw - Intermediate shape returned by `parseResponse`.
   * @returns Canonical `ChatResult`.
   */
  protected normalizeResponse(raw: { content: string; usage: TokenUsage }): ChatResult {
    return {
      content: raw.content.trim(),
      promptTokens: raw.usage.promptTokens ?? 0,
      completionTokens: raw.usage.completionTokens ?? 0,
      totalTokens: raw.usage.totalTokens ?? 0,
    }
  }

  /**
   * Sends a prompt and parses the response against a Zod schema.
   * Combines `chat` + JSON.parse + schema validation into one typed call.
   *
   * @param prompt - The full prompt text.
   * @param schema - Zod schema to validate the parsed JSON response against.
   * @param opts - Optional chat options.
   * @returns `ok(T)` on success, `err(Error)` if the call fails, JSON is invalid, or schema validation fails.
   */
  chatJSON<T>(
    prompt: string,
    schema: ZodType<T>,
    opts?: ChatOptions
  ): ResultAsync<T, Error> {
    return this.chat(prompt, opts).andThen(result => {
      let parsed: unknown
      try {
        parsed = JSON.parse(result.content)
      } catch {
        logger.debug({ provider: this.name, content: result.content.slice(0, 100) }, 'response is not valid JSON')
        return ResultAsync.fromPromise(
          Promise.reject(new Error(`${this.name} returned invalid JSON`)),
          toError
        )
      }
      const validation = schema.safeParse(parsed)
      if (!validation.success) {
        logger.debug({ provider: this.name, issues: validation.error.issues }, 'response failed schema validation')
        return ResultAsync.fromPromise(
          Promise.reject(new Error(`${this.name} response failed schema validation: ${validation.error.message}`)),
          toError
        )
      }
      return ResultAsync.fromPromise(Promise.resolve(validation.data), toError)
    })
  }
}
```

**Step 4: Run to verify tests pass**

```bash
bun test tests/unit/providers/base.test.ts
```
Expected: all 6 tests pass.

**Step 5: Commit**

```bash
git add src/providers/base.ts tests/unit/providers/base.test.ts
git commit -m "feat: add AuditProvider abstract base class with chatJSON and normalizeResponse"
```

---

### Task 3: Update Config with audit provider fields

**Files:**
- Modify: `src/types/index.ts` (add 3 fields to `ConfigSchema`)
- Modify: `src/core/config.ts` (add 3 keys to `KEY_MAP`)
- Modify: `tests/unit/config.test.ts` (add assertions for new keys)

**Step 1: Write the failing tests**

Add to `tests/unit/config.test.ts`:

```ts
it('parses AUDIT_PROVIDER=gemini', () => {
  const result = parseBarfrc('AUDIT_PROVIDER=gemini')
  expect(result.isOk()).toBe(true)
  if (result.isOk()) {
    expect(result.value.auditProvider).toBe('gemini')
  }
})

it('defaults auditProvider to openai', () => {
  const result = parseBarfrc('')
  expect(result.isOk()).toBe(true)
  if (result.isOk()) {
    expect(result.value.auditProvider).toBe('openai')
  }
})

it('parses GEMINI_API_KEY', () => {
  const result = parseBarfrc('GEMINI_API_KEY=mykey')
  expect(result.isOk()).toBe(true)
  if (result.isOk()) {
    expect(result.value.geminiApiKey).toBe('mykey')
  }
})

it('parses GEMINI_MODEL', () => {
  const result = parseBarfrc('GEMINI_MODEL=gemini-2.0-flash')
  expect(result.isOk()).toBe(true)
  if (result.isOk()) {
    expect(result.value.geminiModel).toBe('gemini-2.0-flash')
  }
})

it('defaults geminiModel to gemini-1.5-pro', () => {
  const result = parseBarfrc('')
  expect(result.isOk()).toBe(true)
  if (result.isOk()) {
    expect(result.value.geminiModel).toBe('gemini-1.5-pro')
  }
})
```

**Step 2: Run to verify they fail**

```bash
bun test tests/unit/config.test.ts
```
Expected: failing — `auditProvider` is not a field on `Config`.

**Step 3: Add fields to `ConfigSchema` in `src/types/index.ts`**

In `ConfigSchema`, add after `openaiApiKey`:
```ts
auditProvider: z.enum(['openai', 'gemini']).default('openai'),
geminiApiKey: z.string().default(''),
geminiModel: z.string().default('gemini-1.5-pro'),
```

**Step 4: Add keys to `KEY_MAP` in `src/core/config.ts`**

In the `KEY_MAP` object inside `parseBarfrc`, add:
```ts
AUDIT_PROVIDER: 'auditProvider',
GEMINI_API_KEY: 'geminiApiKey',
GEMINI_MODEL: 'geminiModel',
```

Also add these to `RawConfigSchema.extend({...})` (coerce strings as needed — `auditProvider` and `geminiModel` are strings, no coercion needed beyond what `ConfigSchema` handles).

**Step 5: Run to verify tests pass**

```bash
bun test tests/unit/config.test.ts
```
Expected: all config tests pass.

**Step 6: Commit**

```bash
git add src/types/index.ts src/core/config.ts tests/unit/config.test.ts
git commit -m "feat: add auditProvider, geminiApiKey, geminiModel config fields"
```

---

### Task 4: Install Google Generative AI SDK

**Step 1: Install the package**

```bash
bun add @google/generative-ai
```

**Step 2: Verify installation**

```bash
bun -e "import('@google/generative-ai').then(m => console.log(Object.keys(m)))"
```
Expected: prints exported names including `GoogleGenerativeAI`.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @google/generative-ai SDK dependency"
```

---

### Task 5: Refactor `OpenAIAuditProvider`

Replace the existing function-based `src/providers/openai.ts` with a class extending `AuditProvider`.

**Files:**
- Modify: `src/providers/openai.ts` (full replacement)
- Modify: `tests/unit/openai.test.ts` (full replacement)

**Step 1: Write the failing tests**

```ts
// tests/unit/openai.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'

const mockState = {
  lastArgs: null as unknown,
  error: null as Error | null,
  response: {
    choices: [{ message: { content: '{"pass":true}' } }],
    usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
  } as unknown
}

mock.module('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async (args: unknown) => {
          mockState.lastArgs = args
          if (mockState.error) throw mockState.error
          return mockState.response
        }
      }
    }
    constructor(_opts: unknown) {}
  }
}))

import { OpenAIAuditProvider } from '@/providers/openai'
import { defaultConfig } from '@tests/fixtures/provider'

describe('OpenAIAuditProvider.describe', () => {
  it('returns openai name and requiredConfigKeys', () => {
    const provider = new OpenAIAuditProvider(defaultConfig())
    const info = provider.describe()
    expect(info.name).toBe('openai')
    expect(info.requiredConfigKeys).toContain('openaiApiKey')
  })
})

describe('OpenAIAuditProvider.isConfigured', () => {
  it('returns true when openaiApiKey is set', () => {
    const provider = new OpenAIAuditProvider({ ...defaultConfig(), openaiApiKey: 'sk-test' })
    expect(provider.isConfigured({ ...defaultConfig(), openaiApiKey: 'sk-test' })).toBe(true)
  })
  it('returns false when openaiApiKey is empty', () => {
    const provider = new OpenAIAuditProvider(defaultConfig())
    expect(provider.isConfigured(defaultConfig())).toBe(false)
  })
})

describe('OpenAIAuditProvider.chat', () => {
  beforeEach(() => {
    mockState.lastArgs = null
    mockState.error = null
    mockState.response = {
      choices: [{ message: { content: '{"pass":true}' } }],
      usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
    }
  })

  it('returns ChatResult on success', async () => {
    const provider = new OpenAIAuditProvider({ ...defaultConfig(), openaiApiKey: 'sk-test' })
    const result = await provider.chat('test prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('{"pass":true}')
      expect(result.value.promptTokens).toBe(50)
      expect(result.value.totalTokens).toBe(80)
    }
  })

  it('passes model and temperature to SDK', async () => {
    const provider = new OpenAIAuditProvider({ ...defaultConfig(), openaiApiKey: 'sk-test', auditModel: 'gpt-4o-mini' })
    await provider.chat('prompt', { temperature: 0.5 })
    const args = mockState.lastArgs as Record<string, unknown>
    expect(args.model).toBe('gpt-4o-mini')
    expect(args.temperature).toBe(0.5)
  })

  it('sets response_format when jsonMode is true', async () => {
    const provider = new OpenAIAuditProvider({ ...defaultConfig(), openaiApiKey: 'sk-test' })
    await provider.chat('prompt', { jsonMode: true })
    const args = mockState.lastArgs as Record<string, unknown>
    expect(args.response_format).toEqual({ type: 'json_object' })
  })

  it('returns err on API error', async () => {
    mockState.error = new Error('rate limited')
    const provider = new OpenAIAuditProvider({ ...defaultConfig(), openaiApiKey: 'sk-test' })
    const result = await provider.chat('prompt')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toBe('rate limited')
  })

  it('handles missing usage gracefully', async () => {
    mockState.response = { choices: [{ message: { content: 'hi' } }], usage: undefined }
    const provider = new OpenAIAuditProvider({ ...defaultConfig(), openaiApiKey: 'sk-test' })
    const result = await provider.chat('prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.totalTokens).toBe(0)
  })
})

describe('OpenAIAuditProvider.ping', () => {
  beforeEach(() => {
    mockState.error = null
    mockState.response = {
      choices: [{ message: { content: 'pong' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    }
  })

  it('returns latencyMs and model on success', async () => {
    const provider = new OpenAIAuditProvider({ ...defaultConfig(), openaiApiKey: 'sk-test', auditModel: 'gpt-4o' })
    const result = await provider.ping()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.model).toBe('gpt-4o')
      expect(result.value.latencyMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns err when API call fails', async () => {
    mockState.error = new Error('network failure')
    const provider = new OpenAIAuditProvider({ ...defaultConfig(), openaiApiKey: 'sk-test' })
    const result = await provider.ping()
    expect(result.isErr()).toBe(true)
  })
})
```

**Step 2: Run to verify they fail**

```bash
bun test tests/unit/openai.test.ts
```
Expected: `OpenAIAuditProvider` is not exported from `@/providers/openai`.

**Step 3: Replace `src/providers/openai.ts`**

```ts
// src/providers/openai.ts
import OpenAI from 'openai'
import { Result, ok, err, ResultAsync } from 'neverthrow'
import { AuditProvider } from '@/providers/base'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import type { Config } from '@/types'
import type { ChatResult, ChatOptions, PingResult, ProviderInfo, TokenUsage } from '@/types/schema/provider-schema'

const logger = createLogger('openai')

/**
 * Audit provider backed by the OpenAI chat completions API.
 * Extends {@link AuditProvider} — use `createAuditProvider` to instantiate.
 *
 * @category Providers
 */
export class OpenAIAuditProvider extends AuditProvider {
  readonly name = 'openai'
  private readonly config: Config

  constructor(config: Config) {
    super()
    this.config = config
  }

  /**
   * Returns OpenAI provider metadata including required config keys.
   *
   * @returns `ok(ProviderInfo)` with name, display name, required keys, and supported models.
   */
  describe(): ProviderInfo {
    return {
      name: 'openai',
      displayName: 'OpenAI',
      requiredConfigKeys: ['openaiApiKey'],
      supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    }
  }

  /**
   * Returns true when `openaiApiKey` is non-empty in config.
   *
   * @param config - Loaded barf configuration.
   */
  isConfigured(config: Config): boolean {
    return config.openaiApiKey.length > 0
  }

  /**
   * Sends a minimal prompt to verify connectivity and API key validity.
   *
   * @returns `ok({ latencyMs, model })` on success, `err(Error)` on failure.
   */
  ping(): ResultAsync<PingResult, Error> {
    const model = this.config.auditModel
    return ResultAsync.fromPromise(
      (async (): Promise<PingResult> => {
        const start = Date.now()
        const client = new OpenAI({ apiKey: this.config.openaiApiKey })
        await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        })
        return { latencyMs: Date.now() - start, model }
      })(),
      toError
    )
  }

  /**
   * Sends a single-turn prompt to the OpenAI API.
   * Uses the `openai` SDK which handles 429 retries automatically.
   *
   * @param prompt - Full prompt text.
   * @param opts - Optional temperature, max tokens, and JSON mode.
   * @returns `ok(ChatResult)` on success, `err(Error)` on API failure.
   */
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    return ResultAsync.fromPromise(
      (async (): Promise<ChatResult> => {
        const client = new OpenAI({ apiKey: this.config.openaiApiKey })
        logger.debug({ model: this.config.auditModel, promptLen: prompt.length }, 'sending chat completion')

        const response = await client.chat.completions.create({
          model: this.config.auditModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts?.temperature ?? 0.2,
          max_tokens: opts?.maxTokens,
          ...(opts?.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        })

        const raw = {
          choices: response.choices,
          usage: response.usage,
        }

        const parsed = this.parseResponse(raw)
        if (parsed.isErr()) throw parsed.error
        return this.normalizeResponse(parsed.value)
      })(),
      toError
    )
  }

  /**
   * Extracts content and token counts from an OpenAI chat completion response.
   *
   * @param raw - Raw response object from the OpenAI SDK.
   * @returns `ok({ content, usage })` on success, `err(Error)` if shape is unexpected.
   */
  protected parseResponse(raw: unknown): Result<{ content: string; usage: TokenUsage }, Error> {
    const r = raw as { choices?: Array<{ message?: { content?: string | null } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
    const content = r.choices?.[0]?.message?.content ?? ''
    const usage: TokenUsage = {
      promptTokens: r.usage?.prompt_tokens ?? 0,
      completionTokens: r.usage?.completion_tokens ?? 0,
      totalTokens: r.usage?.total_tokens ?? 0,
    }
    logger.debug({ promptTokens: usage.promptTokens, totalTokens: usage.totalTokens }, 'chat completion done')
    return ok({ content, usage })
  }
}
```

**Step 4: Run to verify tests pass**

```bash
bun test tests/unit/openai.test.ts
```
Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/providers/openai.ts tests/unit/openai.test.ts
git commit -m "feat: refactor OpenAI provider into OpenAIAuditProvider class"
```

---

### Task 6: Create `GeminiAuditProvider`

**Files:**
- Create: `src/providers/gemini.ts`
- Create: `tests/unit/providers/gemini.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/unit/providers/gemini.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'

const mockState = {
  error: null as Error | null,
  text: '{"pass":true}',
  usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 } as unknown
}

mock.module('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel(_opts: unknown) {
      return {
        generateContent: async (_prompt: string) => {
          if (mockState.error) throw mockState.error
          return {
            response: {
              text: () => mockState.text,
              usageMetadata: mockState.usageMetadata,
            }
          }
        }
      }
    }
    constructor(_apiKey: string) {}
  }
}))

import { GeminiAuditProvider } from '@/providers/gemini'
import { defaultConfig } from '@tests/fixtures/provider'

const geminiConfig = () => ({
  ...defaultConfig(),
  geminiApiKey: 'gm-test',
  geminiModel: 'gemini-1.5-pro',
})

describe('GeminiAuditProvider.describe', () => {
  it('returns gemini name and requiredConfigKeys', () => {
    const provider = new GeminiAuditProvider(geminiConfig())
    const info = provider.describe()
    expect(info.name).toBe('gemini')
    expect(info.requiredConfigKeys).toContain('geminiApiKey')
  })
})

describe('GeminiAuditProvider.isConfigured', () => {
  it('returns true when geminiApiKey is set', () => {
    const provider = new GeminiAuditProvider(geminiConfig())
    expect(provider.isConfigured(geminiConfig())).toBe(true)
  })
  it('returns false when geminiApiKey is empty', () => {
    const cfg = { ...geminiConfig(), geminiApiKey: '' }
    const provider = new GeminiAuditProvider(cfg)
    expect(provider.isConfigured(cfg)).toBe(false)
  })
})

describe('GeminiAuditProvider.chat', () => {
  beforeEach(() => {
    mockState.error = null
    mockState.text = '{"pass":true}'
    mockState.usageMetadata = { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }
  })

  it('returns ChatResult on success', async () => {
    const provider = new GeminiAuditProvider(geminiConfig())
    const result = await provider.chat('test prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.content).toBe('{"pass":true}')
      expect(result.value.promptTokens).toBe(20)
      expect(result.value.totalTokens).toBe(30)
    }
  })

  it('returns err on API error', async () => {
    mockState.error = new Error('quota exceeded')
    const provider = new GeminiAuditProvider(geminiConfig())
    const result = await provider.chat('prompt')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.message).toBe('quota exceeded')
  })

  it('handles missing usageMetadata gracefully', async () => {
    mockState.usageMetadata = undefined
    const provider = new GeminiAuditProvider(geminiConfig())
    const result = await provider.chat('prompt')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.totalTokens).toBe(0)
  })
})

describe('GeminiAuditProvider.ping', () => {
  beforeEach(() => {
    mockState.error = null
    mockState.text = 'pong'
    mockState.usageMetadata = { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
  })

  it('returns latencyMs and model on success', async () => {
    const provider = new GeminiAuditProvider(geminiConfig())
    const result = await provider.ping()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.model).toBe('gemini-1.5-pro')
      expect(result.value.latencyMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns err when API call fails', async () => {
    mockState.error = new Error('network failure')
    const provider = new GeminiAuditProvider(geminiConfig())
    const result = await provider.ping()
    expect(result.isErr()).toBe(true)
  })
})
```

**Step 2: Run to verify they fail**

```bash
bun test tests/unit/providers/gemini.test.ts
```
Expected: `Cannot find module '@/providers/gemini'`

**Step 3: Implement `src/providers/gemini.ts`**

```ts
// src/providers/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Result, ok, ResultAsync } from 'neverthrow'
import { AuditProvider } from '@/providers/base'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import type { Config } from '@/types'
import type { ChatResult, ChatOptions, PingResult, ProviderInfo, TokenUsage } from '@/types/schema/provider-schema'

const logger = createLogger('gemini')

/**
 * Audit provider backed by the Google Gemini generative AI API.
 * Extends {@link AuditProvider} — use `createAuditProvider` to instantiate.
 *
 * @category Providers
 */
export class GeminiAuditProvider extends AuditProvider {
  readonly name = 'gemini'
  private readonly config: Config

  constructor(config: Config) {
    super()
    this.config = config
  }

  /**
   * Returns Gemini provider metadata including required config keys.
   *
   * @returns Provider info with name, display name, required keys, and supported models.
   */
  describe(): ProviderInfo {
    return {
      name: 'gemini',
      displayName: 'Google Gemini',
      requiredConfigKeys: ['geminiApiKey'],
      supportedModels: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
    }
  }

  /**
   * Returns true when `geminiApiKey` is non-empty in config.
   *
   * @param config - Loaded barf configuration.
   */
  isConfigured(config: Config): boolean {
    return config.geminiApiKey.length > 0
  }

  /**
   * Sends a minimal prompt to verify connectivity and API key validity.
   *
   * @returns `ok({ latencyMs, model })` on success, `err(Error)` on failure.
   */
  ping(): ResultAsync<PingResult, Error> {
    const model = this.config.geminiModel
    return ResultAsync.fromPromise(
      (async (): Promise<PingResult> => {
        const start = Date.now()
        const client = new GoogleGenerativeAI(this.config.geminiApiKey)
        const genModel = client.getGenerativeModel({ model })
        await genModel.generateContent('ping')
        return { latencyMs: Date.now() - start, model }
      })(),
      toError
    )
  }

  /**
   * Sends a single-turn prompt to the Gemini API.
   *
   * @param prompt - Full prompt text.
   * @param opts - Optional temperature, max tokens, and JSON mode.
   * @returns `ok(ChatResult)` on success, `err(Error)` on API failure.
   */
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    return ResultAsync.fromPromise(
      (async (): Promise<ChatResult> => {
        const client = new GoogleGenerativeAI(this.config.geminiApiKey)
        const genModel = client.getGenerativeModel({
          model: this.config.geminiModel,
          generationConfig: {
            temperature: opts?.temperature ?? 0.2,
            maxOutputTokens: opts?.maxTokens,
            ...(opts?.jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        })

        logger.debug({ model: this.config.geminiModel, promptLen: prompt.length }, 'sending gemini chat')

        const response = await genModel.generateContent(prompt)
        const parsed = this.parseResponse(response.response)
        if (parsed.isErr()) throw parsed.error
        return this.normalizeResponse(parsed.value)
      })(),
      toError
    )
  }

  /**
   * Extracts content and token counts from a Gemini API response.
   *
   * @param raw - Raw response object from the Gemini SDK.
   * @returns `ok({ content, usage })` on success, `err(Error)` if shape is unexpected.
   */
  protected parseResponse(raw: unknown): Result<{ content: string; usage: TokenUsage }, Error> {
    const r = raw as {
      text?: () => string
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
    }
    const content = r.text?.() ?? ''
    const usage: TokenUsage = {
      promptTokens: r.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: r.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: r.usageMetadata?.totalTokenCount ?? 0,
    }
    logger.debug({ promptTokens: usage.promptTokens, totalTokens: usage.totalTokens }, 'gemini chat done')
    return ok({ content, usage })
  }
}
```

**Step 4: Run to verify tests pass**

```bash
bun test tests/unit/providers/gemini.test.ts
```
Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/providers/gemini.ts tests/unit/providers/gemini.test.ts
git commit -m "feat: add GeminiAuditProvider"
```

---

### Task 7: Wire the factory in `src/providers/index.ts`

**Files:**
- Modify: `src/providers/index.ts`
- Create: `tests/unit/providers/factory.test.ts`

**Step 1: Write the failing tests**

```ts
// tests/unit/providers/factory.test.ts
import { describe, it, expect } from 'bun:test'
import { createAuditProvider } from '@/providers/index'
import { OpenAIAuditProvider } from '@/providers/openai'
import { GeminiAuditProvider } from '@/providers/gemini'
import { defaultConfig } from '@tests/fixtures/provider'

describe('createAuditProvider', () => {
  it('returns OpenAIAuditProvider when auditProvider is openai', () => {
    const provider = createAuditProvider({ ...defaultConfig(), auditProvider: 'openai' })
    expect(provider).toBeInstanceOf(OpenAIAuditProvider)
  })

  it('returns GeminiAuditProvider when auditProvider is gemini', () => {
    const provider = createAuditProvider({ ...defaultConfig(), auditProvider: 'gemini' })
    expect(provider).toBeInstanceOf(GeminiAuditProvider)
  })

  it('defaults to OpenAIAuditProvider', () => {
    const provider = createAuditProvider(defaultConfig())
    expect(provider).toBeInstanceOf(OpenAIAuditProvider)
  })
})
```

**Step 2: Run to verify they fail**

```bash
bun test tests/unit/providers/factory.test.ts
```
Expected: `createAuditProvider` not exported.

**Step 3: Update `src/providers/index.ts`**

```ts
// src/providers/index.ts
import { AuditProvider } from '@/providers/base'
import { OpenAIAuditProvider } from '@/providers/openai'
import { GeminiAuditProvider } from '@/providers/gemini'
import type { Config } from '@/types'

export { AuditProvider }
export { OpenAIAuditProvider }
export { GeminiAuditProvider }
export type { ChatResult, ChatOptions, PingResult, ProviderInfo } from '@/providers/base'

/**
 * Creates the configured {@link AuditProvider} implementation.
 *
 * Reads `config.auditProvider` to select the provider. Defaults to OpenAI.
 * To add a new provider, create a class extending {@link AuditProvider} and add a case here.
 *
 * @param config - Loaded barf configuration.
 * @returns The appropriate {@link AuditProvider} instance.
 */
export function createAuditProvider(config: Config): AuditProvider {
  switch (config.auditProvider) {
    case 'gemini': return new GeminiAuditProvider(config)
    case 'openai':
    default:       return new OpenAIAuditProvider(config)
  }
}
```

**Step 4: Run to verify tests pass**

```bash
bun test tests/unit/providers/factory.test.ts
```
Expected: all 3 tests pass.

**Step 5: Commit**

```bash
git add src/providers/index.ts tests/unit/providers/factory.test.ts
git commit -m "feat: add createAuditProvider factory"
```

---

### Task 8: Update `audit.ts` to use `createAuditProvider`

**Files:**
- Modify: `src/cli/commands/audit.ts`
- Modify: `tests/unit/audit-full.test.ts`

**Step 1: Run existing tests to establish baseline**

```bash
bun test tests/unit/audit-full.test.ts tests/unit/audit.test.ts
```
Note current pass/fail state.

**Step 2: Update `audit.ts`**

Replace the `runOpenAIChat` import and the Phase 2 block in `auditIssue`:

```ts
// Remove this import:
// import { runOpenAIChat } from '@/providers/openai'

// Add this import:
import { createAuditProvider } from '@/providers/index'
import { AuditResponseSchema } from '@/types/schema/audit-schema'
```

Replace the API key check and Phase 2 block (lines 113–181) with:

```ts
const auditProvider = createAuditProvider(config)
if (!auditProvider.isConfigured(config)) {
  const info = auditProvider.describe()
  logger.error(
    { provider: auditProvider.name, requiredKeys: info.requiredConfigKeys },
    `${auditProvider.displayName ?? auditProvider.name} is not configured — check .barfrc`
  )
  process.exitCode = 1
  return
}

// ... (Phase 1 checks remain unchanged) ...

// ── Phase 2: AI audit ──────────────────────────────────────────────────────

const auditResult = await auditProvider.chatJSON(prompt, AuditResponseSchema, { jsonMode: true })

if (auditResult.isErr()) {
  logger.error({ issueId, err: auditResult.error.message }, 'audit call failed')
  process.exitCode = 1
  return
}

const auditResponse = auditResult.value
const { totalTokens } = auditResult  // Note: tokens no longer directly accessible here — log via provider name
logger.debug({ issueId, provider: auditProvider.name }, 'audit response received')
```

**Step 3: Update `tests/unit/audit-full.test.ts`**

Replace the `mock.module('openai', ...)` block with a mock of `createAuditProvider`:

```ts
// Instead of mocking the OpenAI SDK, mock the provider factory
import { mock } from 'bun:test'

const mockChatJSON = mock(async () => ({ pass: true }))

mock.module('@/providers/index', () => ({
  createAuditProvider: () => ({
    name: 'mock',
    isConfigured: () => true,
    describe: () => ({ name: 'mock', displayName: 'Mock', requiredConfigKeys: [], supportedModels: [] }),
    chatJSON: mockChatJSON,
  })
}))
```

Update test cases that relied on `mockState.content` to use `mockChatJSON.mockResolvedValue(...)` instead.

**Step 4: Run all audit tests**

```bash
bun test tests/unit/audit.test.ts tests/unit/audit-full.test.ts
```
Expected: all pass.

**Step 5: Commit**

```bash
git add src/cli/commands/audit.ts tests/unit/audit-full.test.ts
git commit -m "feat: wire audit command to createAuditProvider"
```

---

### Task 9: Delete `openai-schema.ts` and fix all references

**Files:**
- Delete: `src/types/schema/openai-schema.ts`
- Delete: `tests/unit/openai-schema.test.ts`
- Modify: `src/types/schema/index.ts` (remove openai-schema re-export if present)

**Step 1: Check for remaining references**

```bash
grep -r "openai-schema" /path/to/barf-ts/src /path/to/barf-ts/tests --include="*.ts"
```
Expected: zero remaining references (all should have been migrated in Tasks 5–8).

**Step 2: Delete the files**

```bash
git rm src/types/schema/openai-schema.ts tests/unit/openai-schema.test.ts
```

**Step 3: Run the full test suite**

```bash
bun test
```
Expected: all 242+ tests pass, no broken imports.

**Step 4: Run type check**

```bash
bunx tsc --noEmit
```
Expected: no errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete openai-schema.ts — types migrated to provider-schema.ts"
```

---

### Task 10: Final verification

**Step 1: Full test suite**

```bash
bun test
```
Expected: all tests pass (count ≥ 242 + new tests from this plan).

**Step 2: Type check**

```bash
bunx tsc --noEmit
```
Expected: zero errors.

**Step 3: Lint and format**

```bash
bun run check
```
Expected: no violations.

**Step 4: Build binary**

```bash
bun run build
```
Expected: `dist/barf` produced without errors.
