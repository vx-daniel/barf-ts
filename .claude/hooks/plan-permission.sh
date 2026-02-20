#!/usr/bin/env bash
# PermissionRequest: ExitPlanMode
# Injects a reminder when permission is requested for ExitPlanMode
set -euo pipefail

input=$(cat)

plan_tmp_dir="$HOME/.claude/plans"
plan_file=$(ls -t "$plan_tmp_dir"/*.md 2>/dev/null | head -1 || true)

if [[ -z "$plan_file" ]]; then
  printf '{"systemMessage": "plan-permission: No plan file detected. Ensure the plan is written before approving exit."}'
  exit 0
fi

title=$(grep -m1 '^# ' "$plan_file" 2>/dev/null | sed 's/^# //' || true)
if [[ -n "$title" ]]; then
  printf '{"systemMessage": "plan-permission: Plan \"%s\" ready for approval."}' "$title"
else
  printf '{"systemMessage": "plan-permission: Plan file exists but has no H1 title. Consider adding one."}'
fi
