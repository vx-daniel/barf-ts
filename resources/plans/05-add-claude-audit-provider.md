# Plan: Add ClaudeAuditProvider

## Context

The audit provider abstraction is complete (OpenAI + Gemini). Adding Claude as a third provider following the identical pattern: `ClaudeAuditProvider extends AuditProvider`, uses the `@anthropic-ai/sdk` for single-turn Messages API calls (not the subprocess approach used by the agent runner in `src/core/claude.ts`).

## Approach

Use `@anthropic-ai/sdk` — consistent with how OpenAI and Gemini use their SDKs. The subprocess approach in `core/claude.ts` is for multi-turn streaming agent work; for a single-turn audit call the Messages API is simpler and more reliable.

## New Config Fields

| .barfrc key | Config field | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | `anthropicApiKey: string` | `''` |
| `CLAUDE_AUDIT_MODEL` | `claudeAuditModel: string` | `'claude-sonnet-4-6'` |

`auditProvider` enum gains `'claude'`: `z.enum(['openai', 'gemini', 'claude'])`.

## Files

| Action | File |
|---|---|
| Install | `bun add @anthropic-ai/sdk` |
| Create | `src/providers/claude.ts` |
| Create | `tests/unit/providers/claude.test.ts` |
| Modify | `src/types/index.ts` — enum + 2 new fields |
| Modify | `src/core/config.ts` — 3 KEY_MAP entries |
| Modify | `src/providers/index.ts` — factory case + export |
| Modify | `tests/unit/config.test.ts` — 5 new tests |
| Modify | `tests/unit/providers/factory.test.ts` — claude case |
| Modify | `tests/unit/prompts.test.ts` — add new config fields to makeConfig |

## ClaudeAuditProvider shape

```ts
export class ClaudeAuditProvider extends AuditProvider {
  readonly name = 'claude'
  private readonly config: Config

  describe(): ProviderInfo  // requiredConfigKeys: ['anthropicApiKey']
  isConfigured(config: Config): boolean  // config.anthropicApiKey.length > 0
  ping(): ResultAsync<PingResult, Error>  // 1-token Messages call, returns latencyMs + model
  chat(prompt: string, opts?: ChatOptions): ResultAsync<ChatResult, Error>
  protected parseResponse(raw: unknown): Result<{ content: string; usage: TokenUsage }, Error>
}
```

`chat()` uses the Anthropic Messages API:
```ts
const client = new Anthropic({ apiKey: this.config.anthropicApiKey })
const response = await client.messages.create({
  model: this.config.claudeAuditModel,
  max_tokens: opts?.maxTokens ?? 4096,
  messages: [{ role: 'user', content: prompt }],
})
```

Note: `temperature` is only supported on extended thinking models — omit for standard use. `jsonMode` is not natively supported in the Messages API the same way — pass `{ jsonMode: true }` as a no-op at the API level (the audit prompt already instructs JSON output).

`parseResponse()` extracts:
- `content`: `response.content[0].type === 'text' ? response.content[0].text : ''`
- `usage`: `{ promptTokens: response.usage.input_tokens, completionTokens: response.usage.output_tokens, totalTokens: input + output }`

## Status

**Implemented.** All tests pass (325/326 — 1 pre-existing failure in `audit.test.ts` unrelated to this change). TypeScript clean. Lint/format clean.
