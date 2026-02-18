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
- **`docs/plans/`** — All implementation plans (numbered `NN-name.md`)
- **`/home/daniel/Projects/barf-loop`** — Original v1 bash implementation (historical reference)
