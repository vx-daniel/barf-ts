[**barf**](README.md)

***

[barf](modules.md) / Audit Providers

# Audit Providers

## Other

### ChatOptions

Re-exports [ChatOptions](types/schema/provider-schema.md#chatoptions)

***

### ChatResult

Re-exports [ChatResult](types/schema/provider-schema.md#chatresult)

***

### ModelInfo

Re-exports [ModelInfo](types/schema/provider-schema.md#modelinfo)

***

### PingResult

Re-exports [PingResult](types/schema/provider-schema.md#pingresult)

***

### ProviderInfo

Re-exports [ProviderInfo](types/schema/provider-schema.md#providerinfo)

***

### TokenUsage

Re-exports [TokenUsage](types/schema/provider-schema.md#tokenusage)

## Providers

### `abstract` AuditProvider

Defined in: src/providers/base.ts:42

Abstract base class for single-turn AI audit providers.

Subclasses implement `chat`, `parseResponse`, `ping`, `describe`, and
`isConfigured`. The concrete methods `chatJSON` and `normalizeResponse`
are inherited and shared across all providers.

#### Example

```ts
const provider = createAuditProvider(config)
const result = await provider.chatJSON(prompt, AuditResponseSchema)
```

#### Extended by

- [`ClaudeAuditProvider`](Audit-Providers-1.md#claudeauditprovider)
- [`CodexAuditProvider`](Audit-Providers-2.md#codexauditprovider)
- [`GeminiAuditProvider`](Audit-Providers-3.md#geminiauditprovider)
- [`OpenAIAuditProvider`](Audit-Providers-6.md#openaiauditprovider)

#### Constructors

##### Constructor

> **new AuditProvider**(): [`AuditProvider`](#abstract-auditprovider)

###### Returns

[`AuditProvider`](#abstract-auditprovider)

#### Properties

##### name

> `abstract` `readonly` **name**: `string`

Defined in: src/providers/base.ts:44

Programmatic identifier used in config and logs (e.g. `'openai'`, `'gemini'`).

#### Methods

##### chat()

> `abstract` **chat**(`prompt`, `opts?`): [`ResultAsync`](#)\<\{ `completionTokens`: `number`; `content`: `string`; `promptTokens`: `number`; `totalTokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/base.ts:76

Sends a single-turn prompt and returns the canonical [ChatResult](types/schema/provider-schema.md#chatresult).

###### Parameters

###### prompt

`string`

The full prompt text to send.

###### opts?

Optional temperature, max tokens, and JSON mode flag.

###### jsonMode?

`boolean` = `...`

###### maxTokens?

`number` = `...`

###### temperature?

`number` = `...`

###### Returns

[`ResultAsync`](#)\<\{ `completionTokens`: `number`; `content`: `string`; `promptTokens`: `number`; `totalTokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(ChatResult)` on success, `err(Error)` on API failure.

##### chatJSON()

> **chatJSON**\<`T`\>(`prompt`, `schema`, `opts?`): [`ResultAsync`](#)\<`T`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/base.ts:134

Sends a prompt and parses the response against a Zod schema.
Combines `chat` + JSON.parse + schema validation into one typed call.

###### Type Parameters

###### T

`T`

###### Parameters

###### prompt

`string`

The full prompt text.

###### schema

`ZodType`\<`T`\>

Zod schema to validate the parsed JSON response against.

###### opts?

Optional chat options.

###### jsonMode?

`boolean` = `...`

###### maxTokens?

`number` = `...`

###### temperature?

`number` = `...`

###### Returns

[`ResultAsync`](#)\<`T`, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(T)` on success, `err(Error)` if the call fails, JSON is invalid, or schema validation fails.

##### describe()

> `abstract` **describe**(): `object`

Defined in: src/providers/base.ts:52

Returns static metadata about this provider.
No network call — safe to call before `isConfigured`.

###### Returns

`object`

Provider name, display name, required config keys, and supported models.

###### displayName

> **displayName**: `string`

###### name

> **name**: `string`

###### requiredConfigKeys

> **requiredConfigKeys**: `string`[]

###### supportedModels

> **supportedModels**: `string`[]

##### isConfigured()

> `abstract` **isConfigured**(`config`): `boolean`

Defined in: src/providers/base.ts:60

Returns true if all required API keys are set in `config`.
Use this to short-circuit before making network calls.

###### Parameters

###### config

Loaded barf configuration.

###### anthropicApiKey

`string` = `...`

Anthropic API key for the Claude audit provider.

###### auditModel

`string` = `...`

Model used for audit provider calls.

###### auditProvider

`"openai"` \| `"gemini"` \| `"claude"` \| `"codex"` = `...`

Which audit provider to use for code review.

###### barfDir

`string` = `...`

Directory for barf internal state (lock files, etc.).

###### buildModel

`string` = `...`

Model used for build mode iterations.

###### claudeAuditModel

`string` = `...`

Model used by the Claude audit provider.

###### claudeTimeout

`number` = `...`

Timeout in seconds for each Claude iteration.

###### contextUsagePercent

`number` = `...`

Percentage of context window to use before triggering overflow (split/escalate).

###### extendedContextModel

`string` = `...`

Model used when escalating past maxAutoSplits (larger context window).

###### fixCommands

`string`[] = `...`

Shell commands to run as fix steps before the test gate (best-effort, failures don't block).

###### geminiApiKey

`string` = `...`

Google Gemini API key for the Gemini audit provider.

###### geminiModel

`string` = `...`

Gemini model identifier for the Gemini audit provider.

###### githubRepo

`string` = `...`

GitHub repository slug (owner/repo) for the GitHub issue provider.

###### issueProvider

`"local"` \| `"github"` = `...`

Issue storage backend: local filesystem or GitHub Issues.

###### issuesDir

`string` = `...`

Directory where issue markdown files are stored. Relative to project root.

###### logFile

`string` = `...`

Path to the pino log file.

###### logLevel

`string` = `...`

Pino log level (trace, debug, info, warn, error, fatal).

###### logPretty

`boolean` = `...`

Enable pretty-printed log output (for development).

###### maxAutoSplits

`number` = `...`

Maximum number of automatic splits before escalating to extended context model.

###### maxIterations

`number` = `...`

Maximum Claude iterations per run. 0 means unlimited.

###### maxVerifyRetries

`number` = `...`

Maximum verification retry attempts before marking issue as verify_exhausted.

###### openaiApiKey

`string` = `...`

OpenAI API key for the OpenAI audit provider.

###### planDir

`string` = `...`

Directory where plan files are written by the plan mode.

###### planModel

`string` = `...`

Model used for plan mode iterations.

###### promptDir

`string` = `...`

Directory for custom prompt templates. Empty string uses built-in prompts.

###### pushStrategy

`"iteration"` \| `"on_complete"` \| `"manual"` = `...`

When to push commits: after each iteration, on completion, or manually.

###### splitModel

`string` = `...`

Model used for split mode iterations (after overflow).

###### streamLogDir

`string` = `...`

Directory for raw JSONL stream logs. Empty string disables logging.

###### testCommand

`string` = `...`

Shell command to run as the test gate during pre-completion checks. Empty string to skip.

###### triageModel

`string` = `...`

Model used for triage one-shot calls.

###### Returns

`boolean`

##### listModels()

> `abstract` **listModels**(): [`ResultAsync`](#)\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/base.ts:93

Queries the provider's API for available models with tier annotations.
Implementations should filter to chat-capable models only and apply
tier classification via `inferTier` from `@/providers/model-tiers`.

###### Returns

[`ResultAsync`](#)\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(ModelInfo[])` on success, `err(Error)` on API failure.

###### Example

```ts
const result = await provider.listModels()
if (result.isOk()) {
  const frontier = result.value.filter(m => m.tier === 'frontier')
}
```

##### normalizeResponse()

> `protected` **normalizeResponse**(`raw`): `object`

Defined in: src/providers/base.ts:113

Maps the intermediate `{ content, usage }` shape to barf's canonical [ChatResult](types/schema/provider-schema.md#chatresult).
Trims content whitespace and zero-fills missing token counts.

###### Parameters

###### raw

Intermediate shape returned by `parseResponse`.

###### content

`string`

###### usage

\{ `completionTokens`: `number`; `promptTokens`: `number`; `totalTokens`: `number`; \}

###### usage.completionTokens

`number` = `...`

###### usage.promptTokens

`number` = `...`

###### usage.totalTokens

`number` = `...`

###### Returns

`object`

Canonical `ChatResult`.

###### completionTokens

> **completionTokens**: `number`

###### content

> **content**: `string`

###### promptTokens

> **promptTokens**: `number`

###### totalTokens

> **totalTokens**: `number`

##### parseResponse()

> `abstract` `protected` **parseResponse**(`raw`): `Result`\<\{ `content`: `string`; `usage`: \{ `completionTokens`: `number`; `promptTokens`: `number`; `totalTokens`: `number`; \}; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/base.ts:102

Extracts content and token usage from a provider-specific raw API response.
Called internally by `chat` implementations.

###### Parameters

###### raw

`unknown`

The raw response object from the provider SDK.

###### Returns

`Result`\<\{ `content`: `string`; `usage`: \{ `completionTokens`: `number`; `promptTokens`: `number`; `totalTokens`: `number`; \}; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok({ content, usage })` on success, `err(Error)` if the response shape is unexpected.

##### ping()

> `abstract` **ping**(): [`ResultAsync`](#)\<\{ `latencyMs`: `number`; `model`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/base.ts:67

Makes a minimal API call to verify connectivity and authentication.

###### Returns

[`ResultAsync`](#)\<\{ `latencyMs`: `number`; `model`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok({ latencyMs, model })` on success, `err(Error)` on failure.
