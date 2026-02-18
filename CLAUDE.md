# barf-ts

TypeScript/Bun rewrite of the bash `barf` CLI — an issue/work management system that orchestrates Claude AI agent work on projects.

## Commands

```bash
bun install                                          # install deps
bun test                                             # run tests
bun build --compile --outfile=dist/barf src/index.ts # compile binary
./dist/barf <command>                                # run compiled binary
bun run check                                        # lint check (oxlint)
bun run lint:fix                                     # auto-fix lint violations
```

## Architecture

```
src/
  index.ts              # CLI entry (commander)
  cli/commands/         # init.ts  plan.ts  build.ts  status.ts  doctor.ts
  core/
    issue.ts            # Frontmatter parser, typed state machine, .working lock
    context.ts          # Async stream parser, SIGTERM on context overflow
    claude.ts           # Claude subprocess wrapper, prompt injection
    config.ts           # .barfrc bash-compat parser
    batch.ts            # Batch orchestration loop
  hooks/
    install.ts          # Writes .claude/settings.json hook entries
  types/index.ts        # Issue, Config, IssueState, ClaudeEvent
tests/
  unit/                 # issue.test.ts  context.test.ts  batch.test.ts
  integration/          # workflow.test.ts
```

## Key Conventions

- **State machine**: `IssueState` transitions are validated by `VALID_TRANSITIONS` in `core/issue.ts` — never mutate state directly, use `transition()`
- **No globals**: ISSUE_ID/MODE/ISSUE_STATE were the bash bugs; pass state as function args
- **Issue files**: Frontmatter markdown (`.barf/issues/`), not SQLite — git-trackable
- **Context monitoring**: Async iterator on Claude's stdout stream, not PostToolUse hooks
- **Hooks**: `barf-hook-precommit` (PreToolUse/Bash) and `barf-hook-stop` (Stop) installed by `barf init`

## Planning Requirements

**All implementation plans must be saved to `docs/plans/`** with the following naming convention:

- **Pattern:** `NN-descriptive-name.md` where `NN` is a sequential number (zero-padded to 2 digits)
- **Example:** `11-realtime-context-overflow-interruption.md`

**Process:**

1. When creating a plan, determine the next sequential number by checking existing files in `docs/plans/`
2. Use a descriptive, hyphenated name that clearly indicates the plan's purpose
3. Save the final plan to `docs/plans/NN-descriptive-name.md`
4. This keeps all AI-generated plans organized and separate from source materials

**Rationale:** Maintaining plans in a numbered sequence creates a clear audit trail of project evolution and prevents plans from mixing with source code or input materials.


## Reference
- **`docs/plans/00-PLAN.md`** — Full architecture spec with phases, state machine types, stream parser design
- **`docs/plans`** — Plans
- **`/home/daniel/Projects/barf-loop`** — Original v1 bash implementation (the first version)
- **`/home/daniel/Projects/barf-loop/barf:620-750`** — Bash `run_loop` to port (study the state bugs, don't repeat them)
- **`/home/daniel/Projects/barf-loop/lib/context.sh`** — Stream parser to replace with `context.ts` async iterator
- **`/home/daniel/Projects/barf-loop/lib/issue.sh`** — Frontmatter/state machine to replace with `issue.ts`
