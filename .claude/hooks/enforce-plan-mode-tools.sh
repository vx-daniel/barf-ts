#!/usr/bin/env bash
# Stop hook: Forces Claude to use ExitPlanMode or AskUserQuestion in plan mode
set -euo pipefail

input=$(cat)

# Prevent infinite loops
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active')
if [[ "$stop_hook_active" == "true" ]]; then
  exit 0
fi

# Only enforce in plan mode
permission_mode=$(echo "$input" | jq -r '.permission_mode')
if [[ "$permission_mode" != "plan" ]]; then
  exit 0
fi

# Block — Claude tried to end turn without a tool call
printf '{"decision": "block", "reason": "You are in plan mode. You MUST end your turn by calling either ExitPlanMode (to present the plan for approval) or AskUserQuestion (to clarify requirements). Do not end your turn with plain text."}'
