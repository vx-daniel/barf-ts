# update-docs Script Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `scripts/update-docs.sh` — a non-interactive bash script that runs `claude -p` to read the codebase and rewrite CLAUDE.md, README.md, AGENTS.md, and PRD.md in one shot.

**Architecture:** Single `claude --print` invocation with a rich embedded prompt. Claude is given read/write tool access scoped to the repo. After completion the script shows `git diff --name-only` so the user can review changes before committing.

**Tech Stack:** bash, `claude` CLI (`claude -p` / `claude --print`), git

---

### Task 1: Create the scripts directory and update-docs.sh

**Files:**
- Create: `scripts/update-docs.sh`

**Step 1: Verify claude CLI is available and supports --print**

```bash
claude --version
claude --help | grep -E '\-p|--print'
```

Expected: version string printed; `--print` flag visible in help output.

**Step 2: Create `scripts/update-docs.sh`**

```bash
#!/usr/bin/env bash
# update-docs.sh — regenerate CLAUDE.md, README.md, AGENTS.md and PRD.md
# using a non-interactive Claude session.
#
# Usage:
#   ./scripts/update-docs.sh            # run from repo root
#   bash scripts/update-docs.sh         # explicit bash
#
# Requirements:
#   - `claude` CLI on $PATH
#   - Run from inside the git repo (any subdirectory is fine)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "==> Updating docs via Claude (non-interactive)..."
echo "    Repo root: $REPO_ROOT"
echo ""

PROMPT=$(cat <<'PROMPT_EOF'
You are updating the documentation for the barf-ts project.

## Your task

Read the codebase thoroughly, then rewrite (or create from scratch if missing) each of the four documentation files listed below so they accurately reflect the current state of the project.

## Files to update

1. **CLAUDE.md** — developer-facing project guide for Claude agents working in this repo.
   - Must include: project purpose, project layout (src/ tree), key conventions, state machine overview, error handling approach, path aliases, logging approach.
   - Keep the `## Key Conventions` section and all bullet points; update them if anything has changed.
   - Do NOT include information that belongs in README.md (install/usage).

2. **README.md** — user-facing documentation.
   - Must include: one-line description, quick-start install, CLI usage (all commands with flags), .barfrc config reference, and a brief architecture section.
   - Keep it practical — someone new to the project should be able to install and run barf from this alone.

3. **AGENTS.md** — guidance specifically for AI agents (Claude, Codex, etc.) that work inside barf-managed projects.
   - Must include: what barf is, how the issue state machine works, what files agents should read/write, how to signal completion, how to handle context overflow.
   - This is read by the AI agent that barf spawns, not by humans setting up the project.

4. **PRD.md** — Product Requirements Document.
   - Preserve the existing `Version`, `Last Updated` (update to today's date), and `Status` fields.
   - Update the feature list, problem statement, and technical requirements to match the current implementation.
   - Keep the overall PRD structure (Executive Summary, Problem Statement, Requirements, etc.).

## How to approach this

1. Use Read/Glob/Grep tools to explore the codebase:
   - Read `src/index.ts`, `src/cli/commands/`, `src/core/`, `src/types/index.ts`
   - Read `src/prompts/` (the prompt templates reveal what barf actually asks Claude to do)
   - Read `package.json` for scripts and dependencies
   - Check `tests/` to understand what is actually tested

2. Read the existing versions of each file before rewriting to understand what must be preserved.

3. Write each updated file using the Write tool. Create the file from scratch if it doesn't exist.

4. Be accurate. Do not invent features or commands that don't exist in the source.
PROMPT_EOF
)

claude --print \
  --allowedTools "Read,Write,Edit,Glob,Grep,Bash" \
  "$PROMPT"

echo ""
echo "==> Done. Changed files:"
git diff --name-only HEAD 2>/dev/null || git status --short
```

**Step 3: Make it executable**

```bash
chmod +x scripts/update-docs.sh
```

**Step 4: Smoke-test — check the script is valid bash (no execution yet)**

```bash
bash -n scripts/update-docs.sh
echo "Syntax OK"
```

Expected: `Syntax OK` printed, no errors.

**Step 5: Commit**

```bash
git add scripts/update-docs.sh
git commit -m "feat: add scripts/update-docs.sh to regenerate docs via claude -p"
```

---

### Task 2: Verify the script runs end-to-end

> Only run this if you want to actually update the docs right now. It will invoke Claude and modify files.

**Step 1: Run the script from the repo root**

```bash
./scripts/update-docs.sh
```

Expected: Claude streams output, then `Changed files:` section lists any modified docs.

**Step 2: Review the diff**

```bash
git diff CLAUDE.md README.md AGENTS.md PRD.md
```

Check that updates are accurate and no content was hallucinated.

**Step 3: Commit docs if satisfied**

```bash
git add CLAUDE.md README.md AGENTS.md PRD.md
git commit -m "docs: update docs via update-docs.sh"
```
