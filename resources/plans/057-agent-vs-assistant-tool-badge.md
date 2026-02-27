# 057 — Show Assistant vs Agent icon on tool calls in activity log

## Context

Tool calls in the activity log all look the same — you can't tell if the main assistant or a subagent made the call. The SDK stream includes `parent_tool_use_id` (`null` for main assistant, a string for subagent calls) but the aggregator doesn't capture it.

## Implementation — 2 files, ~5 lines each

### 1. `tools/dashboard/services/activity-aggregator.ts`

In `parseLogMessage()` line 45-52, add `parentToolUseId` to the `tool_call` data object:

```ts
data: {
  tool: block.name,
  toolUseId: typeof block.id === 'string' ? block.id : undefined,
  parentToolUseId: typeof msg.parent_tool_use_id === 'string'
    ? msg.parent_tool_use_id
    : null,
  args: ...
}
```

### 2. `tools/dashboard/frontend/components/ActivityLog.tsx`

Update `resolveToolMeta` (line 84) to accept `isAgent` flag:

```ts
function resolveToolMeta(toolName: string, isAgent: boolean) {
  if (toolName === 'Task')
    return { borderCls: 'border-l-[#2dd4bf]', badgeText: 'AGENT' }
  if (toolName === 'Skill')
    return { borderCls: 'border-l-accent', badgeText: 'SKILL' }
  if (isAgent)
    return { borderCls: 'border-l-[#2dd4bf]', badgeText: 'AGENT' }
  return { borderCls: 'border-l-info', badgeText: 'TOOL' }
}
```

In `ToolCard` (line 340), derive and pass it:

```ts
const isAgent = entry.data.parentToolUseId != null
const { borderCls, badgeText } = resolveToolMeta(toolName, isAgent)
```

### Result

- Main assistant tool calls → `[TOOL]` blue border (unchanged)
- Subagent tool calls → `[AGENT]` teal border
- `Task` tool itself → always `[AGENT]` (unchanged)

## Verification

1. `bun run dashboard:build`
2. Run a barf command that triggers subagent tool calls
3. Confirm main tools show `[TOOL]`, subagent tools show `[AGENT]`
4. `bun test --filter activity`
