# Adding an Audit Provider

This guide walks through adding a new AI audit provider, following the pattern established by `OpenAIAuditProvider`, `GeminiAuditProvider`, etc.

## File Structure

```
src/providers/
  base.ts           # AuditProvider abstract class
  index.ts          # factory — createAuditProvider()
  openai.ts         # existing provider
  gemini.ts         # existing provider
  claude.ts         # existing provider
  codex.ts          # existing provider
  model-tiers.ts    # tier classification helpers
  your-provider.ts  # ← new file
```

## Step 1: Create the Provider Class

Create `src/providers/your-provider.ts`. Extend `AuditProvider` and implement all abstract methods:

```typescript
/** @module Audit Providers */
import { type Result, ok, ResultAsync } from 'neverthrow'
import { AuditProvider } from '@/providers/base'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'
import type { Config } from '@/types'
import type {
  ChatResult,
  ChatOptions,
  ModelInfo,
  PingResult,
  ProviderInfo,
  TokenUsage,
} from '@/types/schema/provider-schema'

const logger = createLogger('your-provider')

export class YourAuditProvider extends AuditProvider {
  readonly name = 'your-provider'
  private readonly config: Config

  constructor(config: Config) {
    super()
    this.config = config
  }

  /** Static metadata — no network call. */
  describe(): ProviderInfo {
    return {
      name: 'your-provider',
      displayName: 'Your Provider',
      requiredConfigKeys: ['yourApiKey'],  // must match Config field name
      supportedModels: ['model-a', 'model-b'],
    }
  }

  /** True when the required API key is set. */
  isConfigured(config: Config): boolean {
    // Check that the relevant config field is non-empty
    return (config as Record<string, unknown>).yourApiKey !== ''
  }

  /** Minimal API call to verify connectivity. */
  ping(): ResultAsync<PingResult, Error> {
    return ResultAsync.fromPromise(async () => {
      const start = Date.now()
      // Make a minimal API call
      return { latencyMs: Date.now() - start, model: this.config.auditModel }
    }, toError)
  }

  /** Single-turn prompt. */
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error> {
    return ResultAsync.fromPromise(async () => {
      // Call your API
      const raw = { /* raw response */ }
      const parsed = this.parseResponse(raw)
      if (parsed.isErr()) throw parsed.error
      return this.normalizeResponse(parsed.value)
    }, toError)
  }

  /** List available models with tier annotations. */
  listModels(): ResultAsync<ModelInfo[], Error> {
    return ResultAsync.fromPromise(async () => {
      return [] // fetch from API
    }, toError)
  }

  /** Extract content + token counts from raw API response. */
  protected parseResponse(
    raw: unknown,
  ): Result<{ content: string; usage: TokenUsage }, Error> {
    // Parse provider-specific response shape
    return ok({ content: '', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } })
  }
}
```

Key patterns:
- **`parseResponse`** is `protected` — called internally by `chat`, not by consumers
- **`normalizeResponse`** is inherited from `AuditProvider` — call it to trim content and normalize the shape
- **`chatJSON`** is inherited — consumers call it with a Zod schema, it combines `chat` + JSON parse + validation
- **Error handling** — return `ResultAsync`, never throw (except inside `fromPromise` callbacks where it's caught)

## Step 2: Register in the Factory

Edit `src/providers/index.ts` to add the new provider to the factory:

```typescript
import { YourAuditProvider } from '@/providers/your-provider'

export function createAuditProvider(config: Config): AuditProvider {
  switch (config.auditProvider) {
    // ... existing cases
    case 'your-provider':
      return new YourAuditProvider(config)
  }
}
```

## Step 3: Add Config Fields

If your provider needs a new config key (like an API key):

1. Add the field to `ConfigSchema` in `src/types/schema/config-schema.ts`
2. Add the parsing in `src/core/config.ts` → `parseBarfrc()`
3. Document the key in `README.md` under Configuration

## Step 4: Add Model Tiers (Optional)

If the provider has well-known model tiers, add a static tier map in `src/providers/model-tiers.ts`:

```typescript
export const YOUR_TIERS: Record<string, ModelTier> = {
  'model-a': 'frontier',
  'model-b': 'standard',
}
```

Then use `inferTier(modelId, YOUR_TIERS)` in your `listModels()` implementation.

## Checklist

- [ ] Provider file in `src/providers/` with `@module Audit Providers` tag
- [ ] Extends `AuditProvider` and implements all abstract methods
- [ ] Registered in `src/providers/index.ts` factory
- [ ] Config keys added to `ConfigSchema` if needed
- [ ] TSDoc on the class and all public/protected methods
- [ ] Unit tests in `tests/unit/providers/`
