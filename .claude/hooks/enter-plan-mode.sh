#!/usr/bin/env bash
# PostToolUse: EnterPlanMode
# Injects a system message instructing Claude to create a blocking TODO before any work.
set -euo pipefail

cat <<'EOF'
{
  "continue": true,
  "systemMessage": "REQUIRED FIRST ACTION: Call TaskCreate NOW with subject='Write and save plan file — user must approve before any work begins', description='1. Write the plan to ~/.claude/plans/<name>.md\n2. Call ExitPlanMode so the user can review and approve\n3. The save-plan.sh hook copies it to resources/plans/NNN-<slug>.md automatically\n\nDo NOT write any code, edit any files, or take any implementation action until this task is marked completed and the user has approved the plan.', activeForm='Writing plan file'. This task MUST be completed and user-approved before ANY implementation work starts.", "stopReason": null
}
EOF
