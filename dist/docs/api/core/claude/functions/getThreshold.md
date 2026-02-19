[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/claude](../README.md) / getThreshold

# Function: getThreshold()

> **getThreshold**(`model`, `contextUsagePercent`): `number`

Defined in: src/core/claude.ts:48

Computes the token threshold at which barf interrupts a Claude session.
threshold = floor(contextUsagePercent% × modelLimit)

## Parameters

### model

`string`

### contextUsagePercent

`number`

## Returns

`number`
