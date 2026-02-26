[**barf**](README.md)

***

[barf](modules.md) / Orchestration

# Orchestration

Batch orchestration module — public API for the issue processing loop.

This barrel re-exports the key functions and types that consumers need.
Internal implementation details (loop state, outcome handlers, stats
persistence) are not exported — they are implementation details of the
orchestration loop.

## References

### handleOverflow

Re-exports [handleOverflow](Orchestration.md#handleoverflow)

***

### LoopMode

Re-exports [LoopMode](types/schema/mode-schema.md#loopmode)

***

### OverflowDecision

Re-exports [OverflowDecision](types/schema/batch-schema.md#overflowdecision)

***

### resolveIssueFile

Re-exports [resolveIssueFile](Orchestration.md#resolveissuefile)

***

### runLoop

Re-exports [runLoop](Orchestration-2.md#runloop)

***

### RunLoopDeps

Re-exports [RunLoopDeps](Orchestration-2.md#runloopdeps)

***

### shouldContinue

Re-exports [shouldContinue](Orchestration.md#shouldcontinue)
