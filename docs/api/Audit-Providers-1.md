[**barf**](README.md)

***

[barf](modules.md) / Audit Providers

# Audit Providers

## Other

### AnthropicFactory()

> **AnthropicFactory** = (`apiKey`) => `Anthropic`

Defined in: src/providers/claude.ts:20

Factory that constructs an Anthropic SDK client given an API key. Injectable for tests.

#### Parameters

##### apiKey

`string`

#### Returns

`Anthropic`

## Providers

### ClaudeAuditProvider

Defined in: src/providers/claude.ts:33

Audit provider backed by the Anthropic Claude Messages API.
Extends [AuditProvider](Audit-Providers.md#abstract-auditprovider) — use `createAuditProvider` to instantiate.

Uses the SDK directly for single-turn calls (not the subprocess approach in
`core/claude.ts`, which is reserved for multi-turn streaming agent work).

#### Extends

- [`AuditProvider`](Audit-Providers.md#abstract-auditprovider)

#### Constructors

##### Constructor

> **new ClaudeAuditProvider**(`config`, `clientFactory?`): [`ClaudeAuditProvider`](#claudeauditprovider)

Defined in: src/providers/claude.ts:38

###### Parameters

###### config

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

###### clientFactory?

[`AnthropicFactory`](#anthropicfactory) = `...`

###### Returns

[`ClaudeAuditProvider`](#claudeauditprovider)

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`constructor`](Audit-Providers.md#constructor)

#### Properties

##### name

> `readonly` **name**: `"claude"` = `'claude'`

Defined in: src/providers/claude.ts:34

Programmatic identifier used in config and logs (e.g. `'openai'`, `'gemini'`).

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`name`](Audit-Providers.md#name)

#### Methods

##### chat()

> **chat**(`prompt`, `opts?`): [`ResultAsync`](#)\<\{ `completionTokens`: `number`; `content`: `string`; `promptTokens`: `number`; `totalTokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/claude.ts:129

Sends a single-turn prompt to the Anthropic Messages API.

Note: `temperature` is omitted — it is only supported on extended thinking models.
`jsonMode` is treated as a no-op at the API level; the audit prompt already
instructs JSON output.

###### Parameters

###### prompt

`string`

Full prompt text.

###### opts?

Optional max tokens (temperature and jsonMode are ignored).

###### jsonMode?

`boolean` = `...`

###### maxTokens?

`number` = `...`

###### temperature?

`number` = `...`

###### Returns

[`ResultAsync`](#)\<\{ `completionTokens`: `number`; `content`: `string`; `promptTokens`: `number`; `totalTokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(ChatResult)` on success, `err(Error)` on API failure.

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`chat`](Audit-Providers.md#chat)

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

###### Inherited from

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`chatJSON`](Audit-Providers.md#chatjson)

##### describe()

> **describe**(): `object`

Defined in: src/providers/claude.ts:52

Returns Claude provider metadata including required config keys.

###### Returns

`object`

Provider info with name, display name, required keys, and supported models.

###### displayName

> **displayName**: `string`

###### name

> **name**: `string`

###### requiredConfigKeys

> **requiredConfigKeys**: `string`[]

###### supportedModels

> **supportedModels**: `string`[]

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`describe`](Audit-Providers.md#describe)

##### isConfigured()

> **isConfigured**(`config`): `boolean`

Defined in: src/providers/claude.ts:70

Returns true when `anthropicApiKey` is non-empty in config.

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

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`isConfigured`](Audit-Providers.md#isconfigured)

##### listModels()

> **listModels**(): [`ResultAsync`](#)\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/claude.ts:160

Lists available Anthropic Claude models with tier annotations.
Filters to `claude-*` models only. `displayName` comes from the API's `display_name` field.
Tier classification uses [CLAUDE\_TIERS](Audit-Providers-5.md#claude_tiers) with keyword fallback via [inferTier](Audit-Providers-5.md#infertier).

###### Returns

[`ResultAsync`](#)\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(ModelInfo[])` on success, `err(Error)` on API failure.

###### Example

```ts
const result = await provider.listModels()
if (result.isOk()) console.log(result.value)
```

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`listModels`](Audit-Providers.md#listmodels)

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

###### Inherited from

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`normalizeResponse`](Audit-Providers.md#normalizeresponse)

##### parseResponse()

> `protected` **parseResponse**(`raw`): `Result`\<\{ `content`: `string`; `usage`: \{ `completionTokens`: `number`; `promptTokens`: `number`; `totalTokens`: `number`; \}; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/claude.ts:170

Extracts content and token counts from an Anthropic Messages API response.

###### Parameters

###### raw

`unknown`

Raw response object from the Anthropic SDK.

###### Returns

`Result`\<\{ `content`: `string`; `usage`: \{ `completionTokens`: `number`; `promptTokens`: `number`; `totalTokens`: `number`; \}; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok({ content, usage })` on success, `err(Error)` if shape is unexpected.

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`parseResponse`](Audit-Providers.md#parseresponse)

##### ping()

> **ping**(): [`ResultAsync`](#)\<\{ `latencyMs`: `number`; `model`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/claude.ts:91

Sends a minimal prompt to verify connectivity and API key validity.

###### Returns

[`ResultAsync`](#)\<\{ `latencyMs`: `number`; `model`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok({ latencyMs, model })` on success, `err(Error)` on failure.

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`ping`](Audit-Providers.md#ping)
