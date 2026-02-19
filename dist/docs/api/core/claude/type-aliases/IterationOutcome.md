[**barf**](../../../README.md)

***

[barf](../../../README.md) / [core/claude](../README.md) / IterationOutcome

# Type Alias: IterationOutcome

> **IterationOutcome** = `"success"` \| `"overflow"` \| `"error"` \| `"rate_limited"`

Defined in: src/core/claude.ts:20

Outcome of a single Claude agent iteration.
- `success`: iteration completed normally
- `overflow`: context threshold exceeded (see [ContextOverflowError](../../context/classes/ContextOverflowError.md))
- `error`: Claude exited with a non-success status or timed out
- `rate_limited`: API rate limit hit; see `rateLimitResetsAt` for retry time
