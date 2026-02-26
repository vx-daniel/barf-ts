[**barf**](README.md)

***

[barf](modules.md) / Audit Providers

# Audit Providers

## Other

### GeminiFactory()

> **GeminiFactory** = (`apiKey`) => `GoogleGenerativeAI`

Defined in: src/providers/gemini.ts:24

Factory that constructs a GoogleGenerativeAI client given an API key. Injectable for tests.

#### Parameters

##### apiKey

`string`

#### Returns

`GoogleGenerativeAI`

## Providers

### GeminiAuditProvider

Defined in: src/providers/gemini.ts:34

Audit provider backed by the Google Gemini generative AI API.
Extends [AuditProvider](Audit-Providers.md#abstract-auditprovider) — use `createAuditProvider` to instantiate.

#### Extends

- [`AuditProvider`](Audit-Providers.md#abstract-auditprovider)

#### Constructors

##### Constructor

> **new GeminiAuditProvider**(`config`, `clientFactory?`): [`GeminiAuditProvider`](#geminiauditprovider)

Defined in: src/providers/gemini.ts:39

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

[`GeminiFactory`](#geminifactory) = `...`

###### Returns

[`GeminiAuditProvider`](#geminiauditprovider)

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`constructor`](Audit-Providers.md#constructor)

#### Properties

##### name

> `readonly` **name**: `"gemini"` = `'gemini'`

Defined in: src/providers/gemini.ts:35

Programmatic identifier used in config and logs (e.g. `'openai'`, `'gemini'`).

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`name`](Audit-Providers.md#name)

#### Methods

##### chat()

> **chat**(`prompt`, `opts?`): [`ResultAsync`](#)\<\{ `completionTokens`: `number`; `content`: `string`; `promptTokens`: `number`; `totalTokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/gemini.ts:127

Sends a single-turn prompt to the Gemini API.

###### Parameters

###### prompt

`string`

Full prompt text.

###### opts?

Optional temperature, max tokens, and JSON mode.

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

Defined in: src/providers/gemini.ts:53

Returns Gemini provider metadata including required config keys.

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

Defined in: src/providers/gemini.ts:71

Returns true when `geminiApiKey` is non-empty in config.

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

Defined in: src/providers/gemini.ts:176

Lists available Gemini models with tier annotations.
Uses the REST API (`GET /v1beta/models`) since the `@google/generative-ai` SDK has no listModels.
Filters to `gemini-*` models that support `generateContent`.
Tier classification uses [GEMINI\_TIERS](Audit-Providers-5.md#gemini_tiers) with keyword fallback via [inferTier](Audit-Providers-5.md#infertier).

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

Defined in: src/providers/gemini.ts:186

Extracts content and token counts from a Gemini API response.

###### Parameters

###### raw

`unknown`

Raw response object from the Gemini SDK.

###### Returns

`Result`\<\{ `content`: `string`; `usage`: \{ `completionTokens`: `number`; `promptTokens`: `number`; `totalTokens`: `number`; \}; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok({ content, usage })` on success, `err(Error)` if shape is unexpected.

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`parseResponse`](Audit-Providers.md#parseresponse)

##### ping()

> **ping**(): [`ResultAsync`](#)\<\{ `latencyMs`: `number`; `model`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/gemini.ts:89

Sends a minimal prompt to verify connectivity and API key validity.

###### Returns

[`ResultAsync`](#)\<\{ `latencyMs`: `number`; `model`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok({ latencyMs, model })` on success, `err(Error)` on failure.

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`ping`](Audit-Providers.md#ping)
