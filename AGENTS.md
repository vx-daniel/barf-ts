# Agent Guide for barf-managed projects

This file is read by AI agents (Claude, Codex, etc.) that barf spawns to work on issues. If you're reading this, you were launched by `barf plan`, `barf build`, or `barf auto`.

## What is barf?

barf is an issue orchestration CLI. It manages your work through a state machine — you receive an issue file, an optional plan file, and instructions for the current phase (plan or build). barf monitors your context usage and handles overflow automatically.

## Issue state machine

```
NEW → GROOMED → PLANNED → IN_PROGRESS → COMPLETED → VERIFIED
                    ↕           ↕             ↕
                  STUCK       STUCK         STUCK
                  SPLIT       SPLIT         SPLIT
```

- **GROOMED**: Triage passed, requirements are clear. You plan these.
- **PLANNED**: Plan file exists. You build these.
- **IN_PROGRESS**: You're actively working on it (set automatically when build starts).
- **COMPLETED**: All acceptance criteria met. Set this when you're done.
- **VERIFIED**: Build/lint/test pass (barf does this automatically after you complete).
- **STUCK**: You can't proceed. Set this if you're blocked.
- **SPLIT**: Issue was too large and decomposed into children (barf handles this).

## Files you work with

### Issue file

Your issue is at the path given in the prompt (e.g. `issues/003.md`). It has frontmatter:

```markdown
---
id=003
title=Add rate limiting
state=IN_PROGRESS
parent=
children=
split_count=0
---

Description of what to build...

## Acceptance Criteria

- [ ] Rate limiter middleware exists
- [ ] Returns 429 when limit exceeded
- [ ] Configurable per-route limits
```

**Important fields:**
- `state` — update this to `COMPLETED` when done (change it in the frontmatter directly)
- Acceptance criteria — check each `- [ ]` to `- [x]` as you complete it

### Plan file

During **build phase**, read your plan at `plans/<issue-id>.md` (or the path in the prompt). Follow the plan's steps in order.

During **plan phase**, you write the plan to the path specified in the prompt.

## How to signal completion

When all acceptance criteria are met and tests pass:

1. Check all `- [ ]` boxes to `- [x]` in the issue file
2. Change `state=IN_PROGRESS` to `state=COMPLETED` in the frontmatter
3. Commit your changes with a clear message

barf will then run automated verification (build, lint, test). If verification passes, the issue moves to `VERIFIED`. If it fails, barf may create a fix sub-issue and ask you to fix the failures.

## How to handle being stuck

If you cannot complete the issue:

1. Change `state` to `STUCK` in the frontmatter
2. Add a `## Blocked` section to the issue body explaining why
3. Commit the change

## Context overflow

You don't need to manage this. barf monitors your context usage and will:
- **Split** the issue into smaller children if context fills up (first few times)
- **Escalate** to a larger model if splits are exhausted

If you notice you're running low on context, focus on completing as much as possible rather than trying to manage it yourself.

## Build and test commands

Check the project's `package.json` for available scripts. Common patterns:

```bash
bun test                 # run tests
bun run build            # compile/build
bun run check            # lint + format check
```

Always run tests before marking an issue as completed.

## Best practices

1. **Follow TDD**: Write failing tests first, then implement the minimal code to pass
2. **Check acceptance criteria**: Each `- [ ]` item must become `- [x]` before completion
3. **Commit frequently**: Small, focused commits with clear messages
4. **Read before writing**: Understand existing code patterns before adding new code
5. **Use existing patterns**: Match the style and architecture already in the codebase
6. **Don't over-engineer**: Implement exactly what the acceptance criteria ask for

## Verification checks

After you mark an issue `COMPLETED`, barf runs these checks automatically:

1. `bun run build` — project compiles
2. `bun run check` — format + lint pass
3. `bun test` — all tests pass

If any check fails, barf creates a fix sub-issue with the error output and asks you to fix it. This retry loop runs up to `MAX_VERIFY_RETRIES` times (default: 3).

## Session stats

barf tracks token usage, duration, and iteration count per session. After your session ends, a stats block is appended to the issue body. You don't need to manage this.

## Splitting issues (plan phase only)

If barf asks you to split an issue (via the split prompt):

1. Create child issue files in the issues directory: `<parent-id>-1.md`, `<parent-id>-2.md`, etc.
2. Each child gets full frontmatter with `state=NEW` and `parent=<parent-id>`
3. Update the parent issue: set `children=<child-id-1>,<child-id-2>,...` and `state=SPLIT`
4. Commit all changes

Children should be independent, self-contained units of work that can be built separately.
