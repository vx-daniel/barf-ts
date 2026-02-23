# Audit Provider Abstraction Design

**Date:** 2026-02-23
**Status:** Approved

## Problem

The audit command is hardwired to OpenAI. Adding Google Gemini (or any future provider) requires forking the call site logic. The manual `JSON.parse` + `safeParse` + three separate error paths is repeated boilerplate that every new provider would duplicate.

## Goal

An `AuditProvider` abstract class that OpenAI and Gemini extend, with a standalone factory function for instantiation. Adding a new provider in the future means creating one new file and adding one switch case — no other files change.

## Decisions

- **Pattern**: Abstract class (Option A) — `chatJSON` and `normalizeResponse` are concrete methods inherited by all providers, preventing duplication. Mirrors the existing `IssueProvider` pattern.
- **Instantiation**: Standalone factory function `createAuditProvider(config)` in `src/providers/index.ts` — avoids the circular dependency that a static factory method on the base class would create.
- **Gemini role**: Audit evaluator only (single-turn API call), not an agent runner.
- **Config**: Project-wide via `.barfrc` (`AUDIT_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`).
- **Schema cleanup**: `openai-schema.ts` deleted; all types migrate to `provider-schema.ts`.

## Abstract Class Interface

```ts
abstract class AuditProvider {
  abstract readonly name: string

  // Static metadata — no network call
  abstract describe(): ProviderInfo

  // Check required API keys exist in config
  abstract isConfigured(config: Config): boolean

  // Minimal API call to verify connectivity + auth, returns latency
  abstract ping(): ResultAsync<PingResult, Error>

  // Single-turn chat, returns canonical ChatResult
  abstract chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error>

  // Provider-specific: extract content + token counts from raw API response
  protected abstract parseResponse(raw: unknown): Result<{ content: string; usage: TokenUsage }, Error>

  // Shared/concrete: map intermediate form to barf's canonical ChatResult
  protected normalizeResponse(raw: { content: string; usage: TokenUsage }): ChatResult

  // Concrete — inherited by all providers; calls chat() then validates against Zod schema
  chatJSON<T>(prompt: string, schema: ZodType<T>, opts?: ChatOptions): ResultAsync<T, Error>
}
```

## File Structure

```
src/providers/
  base.ts            # AuditProvider abstract class
  openai.ts          # OpenAIAuditProvider extends AuditProvider (refactor existing)
  gemini.ts          # GeminiAuditProvider extends AuditProvider (new)
  index.ts           # createAuditProvider(config) factory + re-exports

src/types/schema/
  provider-schema.ts # TokenUsage, ChatResult, ChatOptions, PingResult, ProviderInfo
  openai-schema.ts   # DELETED — migrated to provider-schema.ts
```

## Shared Schemas (`provider-schema.ts`)

| Schema | Purpose |
|---|---|
| `TokenUsageSchema` | Intermediate shape from `parseResponse` |
| `ChatResultSchema` | Canonical barf output from any provider |
| `ChatOptionsSchema` | Shared options (temperature, maxTokens, jsonMode) |
| `PingResultSchema` | `{ latencyMs, model }` from `ping()` |
| `ProviderInfoSchema` | `{ name, displayName, requiredConfigKeys, supportedModels }` |

## Config Changes

Three new `.barfrc` keys:

| Key | Config field | Default |
|---|---|---|
| `AUDIT_PROVIDER` | `auditProvider: 'openai' \| 'gemini'` | `'openai'` |
| `GEMINI_API_KEY` | `geminiApiKey: string` | `''` |
| `GEMINI_MODEL` | `geminiModel: string` | `'gemini-1.5-pro'` |

## Factory

```ts
// src/providers/index.ts
export function createAuditProvider(config: Config): AuditProvider {
  switch (config.auditProvider) {
    case 'gemini': return new GeminiAuditProvider(config)
    case 'openai':
    default:       return new OpenAIAuditProvider(config)
  }
}
```

## Audit Command Simplification

```ts
// Before: runOpenAIChat → JSON.parse → AuditResponseSchema.safeParse (3 error paths)

// After
const provider = createAuditProvider(config)
if (!provider.isConfigured(config)) {
  logger.error({ provider: provider.name }, `${provider.name} is not configured — check .barfrc`)
  process.exitCode = 1
  return
}
const auditResult = await provider.chatJSON(prompt, AuditResponseSchema)
```

## Testing

| File | Covers |
|---|---|
| `tests/unit/providers/base.test.ts` | `chatJSON`, `normalizeResponse` via `MockAuditProvider` stub |
| `tests/unit/providers/openai.test.ts` | `parseResponse`, `isConfigured`, `describe`, `ping` — SDK mocked |
| `tests/unit/providers/gemini.test.ts` | Same shape, Gemini SDK mocked |
| `tests/unit/cli/commands/audit.test.ts` | Updated to mock `createAuditProvider` instead of `runOpenAIChat` |
