# barf-ts

TypeScript/Bun rewrite of the bash `barf` CLI — an issue/work management system that orchestrates Claude AI agent work on projects.

## Commands

```bash
bun install              # install deps
bun run dev <cmd>        # run from source (no compile step)
bun test                 # run tests (377 tests across 37 files)
bun run build            # compile binary to dist/barf
bun run format           # format with oxfmt (in-place)
bun run format:check     # check formatting (CI)
bun run lint             # lint with oxlint
bun run lint:fix         # auto-fix lint violations
bun run check            # format:check + lint (CI gate)
```

## Architecture

```
src/
  index.ts              # CLI entry (commander)
  cli/commands/         # init  status  plan  build  auto  audit
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
    prompts.ts          # Runtime prompt template resolution (plan/build/split/audit/triage)
    batch.ts            # Orchestration loop (plan/build/split)
    triage.ts           # One-shot triage call (NEW issues → needs_interview flag)
    openai.ts           # OpenAI API client (for audit)
    audit-schema.ts     # Audit result Zod schemas
  providers/            # Pluggable audit providers (openai, gemini, claude)
  types/
    index.ts            # Zod schemas + inferred types (Issue, Config, ClaudeEvent)
    assets.d.ts         # .md text import declaration for Bun
  utils/
    execFileNoThrow.ts  # Shell-injection-safe subprocess helper
    logger.ts           # Pino logger (JSON stderr; LOG_PRETTY=1 for dev)
    toError.ts          # unknown → Error coercion
    syncToResultAsync.ts # sync Result → ResultAsync bridge
  prompts/
    PROMPT_plan.md      # Planning prompt template
    PROMPT_build.md     # Build prompt template
    PROMPT_split.md     # Split prompt template
    PROMPT_audit.md     # Audit prompt template
    PROMPT_triage.md    # Triage prompt template
tests/
  unit/                 # 377 tests across 37 files
  fixtures/             # Test helpers (mock provider, etc.)
  sample-project/       # Sample project for manual testing
```

## Key Conventions

- **State machine**: `IssueState` transitions are validated by `VALID_TRANSITIONS` in `core/issue/index.ts` — never mutate state directly, use `validateTransition()`. States: `NEW → PLANNED → IN_PROGRESS → COMPLETED`, with `STUCK` and `SPLIT` as side-states. `INTERVIEWING` was removed; triage sets `needs_interview` on `Issue` instead.
- **No globals**: pass state as function arguments, never as module-level variables
- **Issue files**: frontmatter markdown in `issuesDir`, not SQLite — git-trackable
- **Context monitoring**: async iterator on Claude's stdout stream, not PostToolUse hooks
- **Path aliases**: use `@/` for `src/` imports, `@tests/` for `tests/` imports — no relative `../` paths
- **Error handling**: all I/O returns `Result`/`ResultAsync` from neverthrow — no thrown errors except at CLI boundary (`src/index.ts`)
- **Logging**: never use `console.*` — always use `createLogger(name)` from `@/utils/logger` (pino, JSON to stderr). Prefer structured context: `logger.info({ key: val }, 'message')` over string interpolation.
- **Zod schemas**: single source of truth — never define types separately from schemas. Zod 4.x required.
- **TypeScript**: strict mode, no `any` types, explicit return types on exported functions.
