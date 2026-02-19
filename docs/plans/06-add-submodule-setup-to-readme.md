# Plan: Add Submodule Setup to README

## Context

The repo has a git submodule at `tests/sample-project` (pointing to `git@github.com:vx-daniel/barf-test-project.git`) used for manual testing. New contributors need to know to initialize it after cloning or it will be an empty directory and `barf --cwd tests/sample-project` won't work.

## Change

**File:** `README.md`

Add `git submodule update --init` to the **Development** section's install steps, immediately after `bun install`:

```bash
bun install
git submodule update --init   # fetch tests/sample-project
bun test
...
```

Also add a brief note beneath the code block explaining the submodule (`tests/sample-project` — used for manual end-to-end testing via `barf --cwd tests/sample-project`).

## Verification

- Read the updated README and confirm the submodule line is present and accurate
- Check that existing structure/formatting is unchanged
