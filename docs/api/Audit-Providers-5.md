[**barf**](README.md)

***

[barf](modules.md) / Audit Providers

# Audit Providers

## Other

### inferTier()

> **inferTier**(`modelId`, `providerMap?`): `"small"` \| `"general"` \| `"frontier"`

Defined in: src/providers/model-tiers.ts:66

Infers a [ModelTier](types/schema/provider-schema.md#modeltier) for a given model ID.
Looks up `providerMap` first; falls back to keyword heuristics on the model ID.

The keyword fallback covers:
- `small`: contains `\bmini`, `flash`, `haiku`, `lite`, `nano`, or `fast` (word-boundary before `mini` prevents false-matching `gemini`)
- `frontier`: matches `opus`, `ultra`, `o1` (not `o1-mini`), `o3` (not `o3-mini`), or `thinking`
- `general`: everything else

#### Parameters

##### modelId

`string`

The model identifier to classify.

##### providerMap?

[`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, `"small"` \| `"general"` \| `"frontier"`\>

Optional per-provider lookup table (e.g. [OPENAI\_TIERS](#openai_tiers)).

#### Returns

`"small"` \| `"general"` \| `"frontier"`

The inferred tier for the model.

***

### prettifyModelId()

> **prettifyModelId**(`id`): `string`

Defined in: src/providers/model-tiers.ts:90

Converts a model ID string into a human-readable display name.
Capitalizes the first letter and replaces hyphens with spaces.

#### Parameters

##### id

`string`

Raw model identifier (e.g. `"gpt-4o-mini"`).

#### Returns

`string`

Display-friendly string (e.g. `"Gpt 4o mini"`).

## Providers

### CLAUDE\_TIERS

> `const` **CLAUDE\_TIERS**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, [`ModelTier`](types/schema/provider-schema.md#modeltier)\>

Defined in: src/providers/model-tiers.ts:28

Static tier map for Anthropic Claude models.
Haiku = small, Sonnet = general, Opus = frontier.

***

### GEMINI\_TIERS

> `const` **GEMINI\_TIERS**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, [`ModelTier`](types/schema/provider-schema.md#modeltier)\>

Defined in: src/providers/model-tiers.ts:43

Static tier map for Google Gemini models.
Flash (non-2.5) = small, 1.5-pro/2.0-flash = general, 2.5 models = frontier.

***

### OPENAI\_TIERS

> `const` **OPENAI\_TIERS**: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)\<`string`, [`ModelTier`](types/schema/provider-schema.md#modeltier)\>

Defined in: src/providers/model-tiers.ts:10

Per-provider static tier maps keyed by model ID.
These entries take precedence over the keyword-based [inferTier](#infertier) fallback.
