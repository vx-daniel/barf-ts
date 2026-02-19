# barf-ts

TypeScript/Bun rewrite of the bash `barf` CLI — an issue/work management system that orchestrates Claude AI agent work on projects.

## Commands

```bash
bun install              # install deps
bun run dev <cmd>        # run from source (no compile step)
bun test                 # run tests
bun run build            # compile binary to dist/barf
bun run format           # format with oxfmt (in-place)
bun run format:check     # check formatting (CI)
bun run lint             # lint with oxlint
bun run lint:fix         # auto-fix lint violations
bun run check            # format:check + lint (CI gate)
bun run docs             # generate API docs to docs/api/
./dist/barf <command>    # run compiled binary
```

## Architecture

```
src/
  index.ts              # CLI entry (commander)
  cli/commands/         # init.ts  plan.ts  build.ts  status.ts
  core/
    issue.ts            # Frontmatter parser, typed state machine
    context.ts          # Async stream parser, SIGTERM on context overflow
    claude.ts           # Claude subprocess wrapper
    config.ts           # .barfrc KEY=VALUE parser
    batch.ts            # Orchestration loop (plan/build/split)
    issue-providers/
      base.ts           # Abstract IssueProvider base class
      local.ts          # File-system provider (POSIX mkdir locking)
      github.ts         # GitHub Issues provider (gh CLI)
      factory.ts        # Provider factory
  types/index.ts        # Zod schemas + inferred types (Issue, Config, ClaudeEvent)
  types/assets.d.ts     # .md text import declaration for Bun
  utils/
    execFileNoThrow.ts  # Shell-injection-safe subprocess helper
    logger.ts           # Pino logger (JSON stderr; LOG_PRETTY=1 for dev)
  prompts/
    PROMPT_plan.md      # Planning prompt template
    PROMPT_build.md     # Build prompt template
    PROMPT_split.md     # Split prompt template
tests/
  unit/                 # 64 tests across all modules
```

## Key Conventions

- **State machine**: `IssueState` transitions are validated by `VALID_TRANSITIONS` in `core/issue.ts` — never mutate state directly, use `transition()`
- **No globals**: ISSUE_ID/MODE/ISSUE_STATE were the bash bugs; pass state as function args
- **Issue files**: Frontmatter markdown in `issuesDir`, not SQLite — git-trackable
- **Context monitoring**: Async iterator on Claude's stdout stream, not PostToolUse hooks
- **Path aliases**: Use `@/` for `src/` imports, `@tests/` for `tests/` imports — no relative `../` paths
- **Error handling**: All I/O returns `Result`/`ResultAsync` from neverthrow — no thrown errors except at CLI boundary (`src/index.ts`)

## Planning Requirements

**BEFORE writing any plan file**, run:

```bash
ls docs/plans/
```

to determine the next sequential number. **Do not skip this step.**

All plan files **must** follow this exact naming pattern:

```
docs/plans/NN-descriptive-name.md
```

- `NN` — zero-padded two-digit sequence number (e.g. `06`, `07`)
- `descriptive-name` — lowercase, hyphenated, clearly describes the plan
- **Wrong:** `staged-drifting-cosmos.md`, `plan.md`, `my-plan.md`
- **Right:** `06-add-submodule-setup-to-readme.md`

**Process:**

1. `ls docs/plans/` — find the highest existing `NN`
2. Increment by 1 and zero-pad to 2 digits
3. Choose a descriptive hyphenated name
4. Save to `docs/plans/NN-descriptive-name.md`

Plans saved with the wrong name must be renamed before the task is considered complete.


## Reference
- **`docs/plans/00-PLAN.md`** — Full architecture spec with phases, state machine types, stream parser design
- **`docs/plans/`** — All implementation plans (numbered `NN-name.md`)
- **`/home/daniel/Projects/barf-loop`** — Original v1 bash implementation (historical reference)
