# Planning Phase — Issue $BARF_ISSUE_ID

You are planning issue **$BARF_ISSUE_ID**.

## Context

- Study the issue file: `$BARF_ISSUE_FILE`
- Study existing plan (if any): `$PLAN_DIR/$BARF_ISSUE_ID.md`
- Read `AGENTS.md` for build/test commands and codebase conventions

## Phase 1: Understand

1. Read the issue file thoroughly — requirements, acceptance criteria, technical notes
2. Explore the codebase for relevant patterns (launch Explore subagents in parallel)
3. Identify what already exists vs. what needs building (gap analysis)

## Phase 2: Plan

1. Document key design decisions and rationale
2. Map each acceptance criterion to a required test
3. Write the implementation plan: bite-sized TDD steps with exact file paths and commands

## Save Plan

Save the completed plan to: `$PLAN_DIR/$BARF_ISSUE_ID.md`

> barf detects this file automatically and transitions the issue NEW → PLANNED.
> You do not need to update the issue state manually.
