#!/usr/bin/env bash
# PreToolUse: ExitPlanMode
# Blocks ExitPlanMode if no plan file exists or it's empty/missing a title
set -euo pipefail

input=$(cat)

plan_tmp_dir="$HOME/.claude/plans"
plan_file=$(ls -t "$plan_tmp_dir"/*.md 2>/dev/null | head -1 || true)

# No plan file at all
if [[ -z "$plan_file" ]]; then
  printf '{"decision": "block", "reason": "No plan file found in %s. Write your plan before exiting plan mode."}' "$plan_tmp_dir"
  exit 0
fi

# Plan file is empty or near-empty (< 20 bytes)
file_size=$(wc -c < "$plan_file")
if [[ "$file_size" -lt 20 ]]; then
  printf '{"decision": "block", "reason": "Plan file is empty or too short (%s bytes). Add content before exiting plan mode."}' "$file_size"
  exit 0
fi

# Plan file has no H1 title
if ! grep -q '^# ' "$plan_file" 2>/dev/null; then
  printf '{"decision": "block", "reason": "Plan file is missing an H1 title (# Title). Add one so the save hook can generate a filename."}'
  exit 0
fi

# All checks pass
printf '{"decision": "allow"}'
