[**barf**](README.md)

***

[barf](modules.md) / Audit Providers

# Audit Providers

## Other

### ExecFn

> **ExecFn** = *typeof* [`execFileNoThrow`](Utilities.md#execfilenothrow)

Defined in: src/providers/codex.ts:13

Injectable subprocess function — mirrors [execFileNoThrow](Utilities.md#execfilenothrow)'s signature.
Pass a mock in tests to avoid spawning a real codex process.

## Providers

### CodexAuditProvider

Defined in: src/providers/codex.ts:36

Audit provider backed by the `@openai/codex` CLI.
Runs `codex -q <prompt>` as a subprocess — no API key required,
authentication is handled by the user's codex CLI session.

Token counts are always zero (the CLI does not expose them).
Extends [AuditProvider](Audit-Providers.md#abstract-auditprovider) — use `createAuditProvider` to instantiate.

#### Extends

- [`AuditProvider`](Audit-Providers.md#abstract-auditprovider)

#### Constructors

##### Constructor

> **new CodexAuditProvider**(`_config`, `execFn?`): [`CodexAuditProvider`](#codexauditprovider)

Defined in: src/providers/codex.ts:40

###### Parameters

###### \_config

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

###### execFn?

(`file`, `args`) => [`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)\<\{ `status`: `number`; `stderr`: `string`; `stdout`: `string`; \}\>

###### Returns

[`CodexAuditProvider`](#codexauditprovider)

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`constructor`](Audit-Providers.md#constructor)

#### Properties

##### name

> `readonly` **name**: `"codex"` = `'codex'`

Defined in: src/providers/codex.ts:37

Programmatic identifier used in config and logs (e.g. `'openai'`, `'gemini'`).

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`name`](Audit-Providers.md#name)

#### Methods

##### chat()

> **chat**(`prompt`, `opts?`): [`ResultAsync`](#)\<\{ `completionTokens`: `number`; `content`: `string`; `promptTokens`: `number`; `totalTokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/codex.ts:126

Runs `codex exec --full-auto --ephemeral <prompt>` as a subprocess and returns stdout as the response.
Token counts are always zero — the codex CLI does not expose them.

###### Parameters

###### prompt

`string`

Full prompt text.

###### opts?

Ignored; temperature/maxTokens/jsonMode not applicable to the codex CLI.

###### jsonMode?

`boolean` = `...`

###### maxTokens?

`number` = `...`

###### temperature?

`number` = `...`

###### Returns

[`ResultAsync`](#)\<\{ `completionTokens`: `number`; `content`: `string`; `promptTokens`: `number`; `totalTokens`: `number`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok(ChatResult)` on success, `err(Error)` if the subprocess fails.

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

Defined in: src/providers/codex.ts:51

Returns Codex provider metadata.
No required config keys — codex authenticates via its own CLI session.

###### Returns

`object`

Provider info with name, display name, empty required keys, and supported models.

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

> **isConfigured**(`_config`): `boolean`

Defined in: src/providers/codex.ts:66

Always returns true — codex requires no config keys.
Availability is only determined at runtime when the subprocess runs.

###### Parameters

###### \_config

Unused; no config keys required for codex.

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

Defined in: src/providers/codex.ts:139

Returns the static Codex model list. No API call is needed.
The codex CLI exposes a single model entry.

###### Returns

[`ResultAsync`](#)\<`object`[], [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok([{ id: 'codex', displayName: 'Codex CLI', tier: 'general' }])` always.

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

Defined in: src/providers/codex.ts:152

Wraps the raw codex stdout into the canonical `{ content, usage }` shape.
Token usage is always zero.

###### Parameters

###### raw

`unknown`

Object with a `content` field (the subprocess stdout).

###### Returns

`Result`\<\{ `content`: `string`; `usage`: \{ `completionTokens`: `number`; `promptTokens`: `number`; `totalTokens`: `number`; \}; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok({ content, usage })` always.

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`parseResponse`](Audit-Providers.md#parseresponse)

##### ping()

> **ping**(): [`ResultAsync`](#)\<\{ `latencyMs`: `number`; `model`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

Defined in: src/providers/codex.ts:91

Runs a minimal codex prompt to verify the CLI is installed and authenticated.

###### Returns

[`ResultAsync`](#)\<\{ `latencyMs`: `number`; `model`: `string`; \}, [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)\>

`ok({ latencyMs, model })` on success, `err(Error)` if codex is not found or fails.

###### Overrides

[`AuditProvider`](Audit-Providers.md#abstract-auditprovider).[`ping`](Audit-Providers.md#ping)
