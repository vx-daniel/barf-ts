[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

Context window management — model token limits and threshold computation.

Barf monitors Claude's context window usage during each iteration to decide
when to interrupt (overflow). This module manages the per-model token limits
and computes the interrupt threshold from the configured percentage.

The token limit registry is mutable so tests can register custom models
and new models can be added at runtime without recompilation.

## Claude Agent

### DEFAULT\_CONTEXT\_LIMIT

> `const` **DEFAULT\_CONTEXT\_LIMIT**: `200000` = `200_000`

Defined in: src/core/claude/context.ts:22

Fallback context-window token limit for models not in the registry.

Used when a model identifier isn't found in MODEL\_CONTEXT\_LIMITS.
Set to 200,000 tokens which matches current Claude model context windows.

***

### getContextLimit()

> **getContextLimit**(`model`): `number`

Defined in: src/core/claude/context.ts:46

Returns the context-window token limit for a given model.

Looks up the model in the MODEL\_CONTEXT\_LIMITS registry and
falls back to [DEFAULT\_CONTEXT\_LIMIT](#default_context_limit) for unregistered models.

#### Parameters

##### model

`string`

Claude model identifier string (e.g. `'claude-sonnet-4-6'`).

#### Returns

`number`

Token limit for the model.

***

### getThreshold()

> **getThreshold**(`model`, `contextUsagePercent`): `number`

Defined in: src/core/claude/context.ts:78

Computes the token threshold at which barf interrupts a Claude session.

The formula is: `threshold = floor(contextUsagePercent / 100 × modelLimit)`

For example, with a 200,000 token model and 75% usage, the threshold
is 150,000 tokens. When cumulative input tokens reach this level,
barf interrupts the session and triggers an overflow decision.

#### Parameters

##### model

`string`

Claude model identifier (used to look up the context limit).

##### contextUsagePercent

`number`

Percentage of context window to use (1-100).

#### Returns

`number`

Token count at which to interrupt the session.

***

### setContextLimit()

> **setContextLimit**(`model`, `limit`): `void`

Defined in: src/core/claude/context.ts:60

Registers or overrides the context-window token limit for a model.

Useful in tests to set up custom models, or for models added after
compile time that aren't in the default registry.

#### Parameters

##### model

`string`

Model identifier string.

##### limit

`number`

Token limit to associate with this model.

#### Returns

`void`
