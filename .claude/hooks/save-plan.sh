#!/usr/bin/env bash
# PostToolUse: ExitPlanMode
# Copies the current plan file to $PROJECT_PLANS_DIR/NNN-descriptive-name.md
set -euo pipefail

input=$(cat)

# Resolve plans directory from env (may be relative like ./docs/plans)
if [[ "${PROJECT_PLANS_DIR:-}" == ./* ]]; then
  plans_dir="${CLAUDE_PROJECT_DIR}/${PROJECT_PLANS_DIR#./}"
elif [[ -n "${PROJECT_PLANS_DIR:-}" ]]; then
  plans_dir="$PROJECT_PLANS_DIR"
else
  plans_dir="${CLAUDE_PROJECT_DIR}/memory/plans"
fi

# Find the current plan file (most recently modified .md in ~/.claude/plans/)
plan_tmp_dir="$HOME/.claude/plans"
plan_file=$(ls -t "$plan_tmp_dir"/*.md 2>/dev/null | head -1 || true)

if [[ -z "$plan_file" ]]; then
  printf '{"continue": true, "systemMessage": "save-plan: no plan file found in %s"}' "$plan_tmp_dir"
  exit 0
fi

# Extract H1 title from plan, convert to kebab-case slug
title=$(grep -m1 '^# ' "$plan_file" 2>/dev/null | sed 's/^# //' || true)
if [[ -n "$title" ]]; then
  slug=$(echo "$title" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' \
    | sed 's/-\{2,\}/-/g' \
    | sed 's/^-//;s/-$//')
else
  slug=$(basename "$plan_file" .md)
fi

# Find next NNN: scan plans_dir for highest numeric prefix, increment, zero-pad to 3
mkdir -p "$plans_dir"
last_num=$(ls "$plans_dir"/ 2>/dev/null | grep -oE '^[0-9]+' | sort -n | tail -1 || true)
last_num=${last_num:-0}
next_num=$(printf "%03d" $((10#$last_num + 1)))

dest="${plans_dir}/${next_num}-${slug}.md"
cp "$plan_file" "$dest"

printf '{"continue": true, "systemMessage": "Plan saved → %s"}' "$dest"