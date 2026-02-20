# barf-ts

TypeScript/Bun rewrite of the bash `barf` CLI — an issue/work management system that orchestrates Claude AI agent work on projects.

## Commands

```bash
bun install              # install deps
bun run dev <cmd>        # run from source (no compile step)
bun test                 # run tests (227 tests across 24 files)
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
  cli/commands/         # init  status  interview  plan  build  auto  audit
  core/
    issue/
      index.ts          # Frontmatter parser, typed state machine, VALID_TRANSITIONS
      base.ts           # Abstract IssueProvider base class
      factory.ts        # Provider factory
      providers/
        local.ts        # File-system provider (POSIX mkdir locking)
        github.ts       # GitHub Issues provider (gh CLI)
    config.ts           # .barfrc KEY=VALUE parser
    context.ts          # Async stream parser, SIGTERM on context overflow
    claude.ts           # Claude subprocess wrapper
    batch.ts            # Orchestration loop (plan/build/split)
    interview.ts        # Interview loop logic
    openai.ts           # OpenAI API client (for audit)
    audit-schema.ts     # Audit result Zod schemas
  types/
    index.ts            # Zod schemas + inferred types (Issue, Config, ClaudeEvent)
    assets.d.ts         # .md text import declaration for Bun
  utils/
    execFileNoThrow.ts  # Shell-injection-safe subprocess helper
    logger.ts           # Pino logger (JSON stderr; LOG_PRETTY=1 for dev)
    toError.ts          # unknown → Error coercion
    syncToResultAsync.ts # sync Result → ResultAsync bridge
  prompts/
    PROMPT_interview.md # Interview prompt template
    PROMPT_plan.md      # Planning prompt template
    PROMPT_build.md     # Build prompt template
    PROMPT_split.md     # Split prompt template
    PROMPT_audit.md     # Audit prompt template
tests/
  unit/                 # 227 tests across 24 files
  fixtures/             # Test helpers (mock provider, etc.)
  sample-project/       # Sample project for manual testing (barf --cwd tests/sample-project)
```

## Key Conventions

- **State machine**: `IssueState` transitions are validated by `VALID_TRANSITIONS` in `core/issue/index.ts` — never mutate state directly, use `validateTransition()`. States: `NEW → INTERVIEWING → PLANNED → IN_PROGRESS → COMPLETED`, with `STUCK` and `SPLIT` as side-states.
- **No globals**: ISSUE_ID/MODE/ISSUE_STATE were the bash bugs; pass state as function args
- **Issue files**: Frontmatter markdown in `issuesDir`, not SQLite — git-trackable
- **Context monitoring**: Async iterator on Claude's stdout stream, not PostToolUse hooks
- **Stream logging**: Set `STREAM_LOG_DIR` in `.barfrc` to append raw JSONL per-issue to `{dir}/{issueId}.jsonl` (disabled by default). Useful for debugging Claude output.
- **Path aliases**: Use `@/` for `src/` imports, `@tests/` for `tests/` imports — no relative `../` paths
- **Error handling**: All I/O returns `Result`/`ResultAsync` from neverthrow — no thrown errors except at CLI boundary (`src/index.ts`)
- **Logging**: Never use `console.*` — always use `createLogger(name)` from `@/utils/logger` (pino, JSON to stderr + log file). Use `LOG_PRETTY=1` in dev for readable output. Prefer structured context: `logger.info({ key: val }, 'message')` over string interpolation.
