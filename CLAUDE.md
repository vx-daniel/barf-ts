# barf-ts

TypeScript/Bun rewrite of the bash `barf` CLI — an issue/work management system that orchestrates Claude AI agent work on projects.

See README.md for installation, setup, and usage documentation.

### Project layout

```
src/
  index.ts                    CLI entry (commander)
  cli/commands/               init  status  plan  build  auto  audit
  core/
    issue/
      index.ts                frontmatter parser, state machine
      base.ts                 abstract IssueProvider
      factory.ts              provider factory
      providers/
        local.ts              file-system provider (POSIX mkdir locking)
        github.ts             GitHub Issues provider (gh CLI)
    config.ts                 .barfrc parser
    context.ts                Claude stream parser, prompt injection
    claude.ts                 Claude subprocess wrapper
    prompts.ts                runtime prompt template resolution (plan/build/split/audit/triage)
    batch.ts                  orchestration loop (plan/build/split/verify)
    triage.ts                 one-shot triage call (NEW issues → needs_interview flag)
    verification.ts           post-COMPLETED verification (build/check/test → VERIFIED)
    openai.ts                 OpenAI API client
    audit-schema.ts           audit result Zod schemas
  providers/                  pluggable audit providers (openai, gemini, claude)
  types/
    index.ts                  Zod schemas + inferred types
    assets.d.ts               .md text import declaration for Bun
  utils/
    execFileNoThrow.ts        shell-injection-safe subprocess
    logger.ts                 pino logger
    toError.ts                unknown → Error coercion
    syncToResultAsync.ts      sync Result → ResultAsync bridge
  prompts/
    PROMPT_plan.md            planning prompt template
    PROMPT_build.md           build prompt template
    PROMPT_split.md           split prompt template
    PROMPT_audit.md           audit prompt template
    PROMPT_triage.md          triage prompt template
tests/
  unit/                       413 tests across 38 files
  fixtures/                   test helpers (mock provider, etc.)
  sample-project/             sample project for manual testing (barf --cwd tests/sample-project)
```


## Planning Requirements

**BEFORE writing any plan file**, run:

```bash
ls ${PROJECT_PLANS_DIR}/
```

to determine the next sequential number. **Do not skip this step.**

All plan files **must** follow this exact naming pattern:

```
${PROJECT_PLANS_DIR}/NNN-descriptive-name.md
```

- `NNN` — zero-padded three-digit sequence number (e.g. `006`, `007`)
- `descriptive-name` — lowercase, hyphenated, clearly describes the plan
- **Wrong:** `staged-drifting-cosmos.md`, `plan.md`, `my-plan.md`
- **Right:** `006-add-submodule-setup-to-readme.md`

**Process:**

1. `ls ${PROJECT_PLANS_DIR}` — find the highest existing `NNN`
2. Increment by 1 and zero-pad to 3 digits
3. Choose a descriptive hyphenated name
4. Save to `${PROJECT_PLANS_DIR}/NNN-descriptive-name.md`

Plans saved with the wrong name must be renamed before the task is considered complete.


## Key Conventions

- **State machine**: `IssueState` transitions are validated by `VALID_TRANSITIONS` in `core/issue/index.ts` — never mutate state directly, use `validateTransition()`. States: `NEW → PLANNED → IN_PROGRESS → COMPLETED → VERIFIED`, with `STUCK` and `SPLIT` as side-states. `VERIFIED` is the true terminal state (post-verification). `INTERVIEWING` was removed; triage sets `needs_interview` on `Issue` instead.
- **No globals**: ISSUE_ID/MODE/ISSUE_STATE were the bash bugs; pass state as function args
- **Issue files**: Frontmatter markdown in `issuesDir`, not SQLite — git-trackable
- **Context monitoring**: Async iterator on Claude's stdout stream, not PostToolUse hooks
- **Stream logging**: Set `STREAM_LOG_DIR` in `.barfrc` to append raw JSONL per-issue to `{dir}/{issueId}.jsonl` (disabled by default). Useful for debugging Claude output.
- **Path aliases**: Use `@/` for `src/` imports, `@tests/` for `tests/` imports — no relative `../` paths
- **Error handling**: All I/O returns `Result`/`ResultAsync` from neverthrow — no thrown errors except at CLI boundary (`src/index.ts`)
- **Logging**: Never use `console.*` — always use `createLogger(name)` from `@/utils/logger` (pino, JSON to stderr + log file). Use `LOG_PRETTY=1` in dev for readable output. Prefer structured context: `logger.info({ key: val }, 'message')` over string interpolation.
