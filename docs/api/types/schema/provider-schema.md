[**barf**](../../README.md)

***

[barf](../../modules.md) / types/schema/provider-schema

# types/schema/provider-schema

## Other

### ChatOptions

> **ChatOptions** = `object`

Defined in: src/types/schema/provider-schema.ts:47

Derived from [ChatOptionsSchema](#chatoptionsschema).

#### Type Declaration

##### jsonMode?

> `optional` **jsonMode**: `boolean`

##### maxTokens?

> `optional` **maxTokens**: `number`

##### temperature?

> `optional` **temperature**: `number`

***

### ChatResult

> **ChatResult** = `object`

Defined in: src/types/schema/provider-schema.ts:33

Derived from [ChatResultSchema](#chatresultschema).

#### Type Declaration

##### completionTokens

> **completionTokens**: `number`

##### content

> **content**: `string`

##### promptTokens

> **promptTokens**: `number`

##### totalTokens

> **totalTokens**: `number`

***

### ModelInfo

> **ModelInfo** = `object`

Defined in: src/types/schema/provider-schema.ts:81

Derived from [ModelInfoSchema](#modelinfoschema).

#### Type Declaration

##### displayName

> **displayName**: `string`

##### id

> **id**: `string`

##### tier

> **tier**: `"small"` \| `"general"` \| `"frontier"` = `ModelTierSchema`

***

### ModelTier

> **ModelTier** = `"small"` \| `"general"` \| `"frontier"`

Defined in: src/types/schema/provider-schema.ts:68

Derived from [ModelTierSchema](#modeltierschema).

***

### PingResult

> **PingResult** = `object`

Defined in: src/types/schema/provider-schema.ts:59

Derived from [PingResultSchema](#pingresultschema).

#### Type Declaration

##### latencyMs

> **latencyMs**: `number`

##### model

> **model**: `string`

***

### ProviderInfo

> **ProviderInfo** = `object`

Defined in: src/types/schema/provider-schema.ts:96

Derived from [ProviderInfoSchema](#providerinfoschema).

#### Type Declaration

##### displayName

> **displayName**: `string`

##### name

> **name**: `string`

##### requiredConfigKeys

> **requiredConfigKeys**: `string`[]

##### supportedModels

> **supportedModels**: `string`[]

***

### TokenUsage

> **TokenUsage** = `object`

Defined in: src/types/schema/provider-schema.ts:18

Derived from [TokenUsageSchema](#tokenusageschema).

#### Type Declaration

##### completionTokens

> **completionTokens**: `number`

##### promptTokens

> **promptTokens**: `number`

##### totalTokens

> **totalTokens**: `number`

***

### DEFAULT\_TEMPERATURE

> `const` **DEFAULT\_TEMPERATURE**: `0.2` = `0.2`

Defined in: src/types/schema/provider-schema.ts:4

Default sampling temperature for audit providers.

***

### toTokenUsage()

> **toTokenUsage**(`prompt?`, `completion?`, `total?`): `object`

Defined in: src/types/schema/provider-schema.ts:108

Constructs a [TokenUsage](#tokenusage) from optional raw API token counts.
All fields default to 0; `totalTokens` defaults to `prompt + completion`
when the API omits it (e.g. Anthropic Messages API).

#### Parameters

##### prompt?

Raw prompt token count from the API response

`number` | `null`

##### completion?

Raw completion token count from the API response

`number` | `null`

##### total?

Raw total token count; defaults to `prompt + completion` when absent

`number` | `null`

#### Returns

`object`

Fully-populated [TokenUsage](#tokenusage) with no optional fields

##### completionTokens

> **completionTokens**: `number`

##### promptTokens

> **promptTokens**: `number`

##### totalTokens

> **totalTokens**: `number`

## Providers

### ChatOptionsSchema

> `const` **ChatOptionsSchema**: `ZodObject`\<[`ChatOptions`](#chatoptions)\>

Defined in: src/types/schema/provider-schema.ts:41

Options accepted by `chat` and `chatJSON`. All fields are optional.
`jsonMode` enables provider-native structured JSON output.

***

### ChatResultSchema

> `const` **ChatResultSchema**: `ZodObject`\<[`ChatResult`](#chatresult)\>

Defined in: src/types/schema/provider-schema.ts:26

Canonical output returned by any AuditProvider's `chat` method.
All callers depend on this shape, never on provider-specific response objects.

***

### ModelInfoSchema

> `const` **ModelInfoSchema**: `ZodObject`\<[`ModelInfo`](#modelinfo)\>

Defined in: src/types/schema/provider-schema.ts:75

Annotated model entry returned by `AuditProvider.listModels`.

***

### ModelTierSchema

> `const` **ModelTierSchema**: `ZodEnum`\<[`ModelTier`](#modeltier)\>

Defined in: src/types/schema/provider-schema.ts:66

Tier classification for a model: `small` = fast/cheap, `general` = balanced, `frontier` = high quality/cost.

***

### PingResultSchema

> `const` **PingResultSchema**: `ZodObject`\<[`PingResult`](#pingresult)\>

Defined in: src/types/schema/provider-schema.ts:54

Result returned by AuditProvider.ping.

***

### ProviderInfoSchema

> `const` **ProviderInfoSchema**: `ZodObject`\<[`ProviderInfo`](#providerinfo)\>

Defined in: src/types/schema/provider-schema.ts:89

Static metadata about a provider. Returned by AuditProvider.describe.
No network call required — used for error messages and config validation.

***

### TokenUsageSchema

> `const` **TokenUsageSchema**: `ZodObject`\<[`TokenUsage`](#tokenusage)\>

Defined in: src/types/schema/provider-schema.ts:12

Intermediate token usage extracted by each provider's `parseResponse`.
All counts default to 0 — providers that omit usage data are safe.
