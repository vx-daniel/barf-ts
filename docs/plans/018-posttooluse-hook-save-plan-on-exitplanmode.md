# PostToolUse hook: save plan on ExitPlanMode

## Context

Currently, plans are written to a temp file (`~/.claude/plans/<random-name>.md`) during planning
and never copied into the project's versioned `docs/plans/` directory — that step is manual and
easy to forget. This hook automates it: whenever `ExitPlanMode` is called, the current plan is
saved to `$PROJECT_PLANS_DIR/NNN-descriptive-name.md` (three-digit zero-padded sequence number,
kebab-case title slug derived from the plan's H1 heading).

`PROJECT_PLANS_DIR` is already set to `./docs/plans` in the project's `env` block in
`.claude/settings.json`, so the hook works out-of-the-box without extra config.

## Files to create / modify

- **create** `.claude/hooks/save-plan.sh` — command hook script
- **modify** `.claude/settings.json` — add `PostToolUse` entry for `ExitPlanMode`

## Implementation

### `.claude/hooks/save-plan.sh`

```bash
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
  plans_dir="${CLAUDE_PROJECT_DIR}/docs/plans"
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
```

### `.claude/settings.json` — add `PostToolUse` block

```json
"hooks": {
  "PostToolUse": [
    {
      "matcher": "ExitPlanMode",
      "hooks": [
        {
          "type": "command",
          "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/save-plan.sh\"",
          "timeout": 15
        }
      ]
    }
  ]
}
```

The settings.json uses the **settings format** (no `hooks` wrapper), so add `PostToolUse`
directly at the top level alongside `permissions`, `env`, etc.

## Key design decisions

| Decision | Rationale |
|---|---|
| `PostToolUse` on `ExitPlanMode` | ExitPlanMode is a tool call; Post fires after it completes |
| Most-recently-modified `.md` in `~/.claude/plans/` | Plan mode writes here; no other mechanism exposes the path to hooks |
| Title → slug from H1 heading | Plans always start with `# Title`; more meaningful than the random temp name |
| 3-digit NNN, handles existing 2-digit NN | `sort -n` treats `17` as 17 regardless of padding; `printf "%03d"` outputs `018` next |
| `$CLAUDE_PROJECT_DIR` in command path | Correct var for project-level hooks (not a plugin, so not `$CLAUDE_PLUGIN_ROOT`) |
| `10#$last_num` arithmetic | Forces decimal even when value like `017` has a leading zero (avoids octal) |

## Verification

```bash
# 1. Enter plan mode, write a plan with a # Title heading, call ExitPlanMode
# 2. Check that the plan appeared in docs/plans/:
ls docs/plans/ | tail -5     # should show NNN-descriptive-name.md

# 3. Confirm NNN is one higher than the previous highest:
ls docs/plans/*.md | grep -oE '^[^/]*/[0-9]+' | sort -n | tail -3

# 4. Test the script directly:
echo '{}' | PROJECT_PLANS_DIR=./docs/plans CLAUDE_PROJECT_DIR=$(pwd) \
  bash .claude/hooks/save-plan.sh
```
