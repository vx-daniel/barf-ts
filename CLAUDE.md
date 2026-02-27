# barf-ts

TypeScript/Bun rewrite of the bash `barf` CLI — an issue/work management system that orchestrates Claude AI agent work on projects.

See README.md for installation, setup, and usage documentation.

### Project layout

```
src/
  index.ts                        CLI entry (commander)
  cli/commands/                   init  status  plan  build  auto  audit  triage
  core/
    issue/
      index.ts                    frontmatter parser, state machine
      base.ts                     abstract IssueProvider
      factory.ts                  provider factory
      providers/
        local.ts                  file-system provider (POSIX O_CREAT|O_EXCL locking)
        github.ts                 GitHub Issues provider (gh CLI)
        github-labels.ts          label constants for GitHub provider
    config.ts                     .barfrc KEY=VALUE parser
    context.ts                    ContextOverflowError, RateLimitError, template var injection
    pre-complete.ts               pre-complete fix commands + test runner
    prompts.ts                    runtime prompt template resolution
    batch/
      index.ts                    barrel
      loop.ts                     runLoop() — main iteration loop
      helpers.ts                  shouldContinue, handleOverflow, resolveIssueFile, planSplitChildren
      outcomes.ts                 split/overflow/plan/build completion handlers
      stats.ts                    session stats creation + persistence
    claude/
      index.ts                    barrel
      iteration.ts                runClaudeIteration() — SDK invocation + stream logging
      stream.ts                   consumeSDKQuery() — async iterator, token tracking, overflow detection
      context.ts                  MODEL_CONTEXT_LIMITS, getThreshold()
      display.ts                  TTY progress rendering (sticky header, context %)
    triage/
      index.ts                    barrel
      triage.ts                   triageIssue() — subprocess-based one-shot triage
      parse.ts                    parseTriageResponse(), formatQuestionsSection()
    verification/
      index.ts                    barrel
      orchestration.ts            verifyIssue() — run checks, create fix sub-issues
      checks.ts                   DEFAULT_VERIFY_CHECKS, runVerification()
      format.ts                   buildFixBody() — formats failure output for fix issues
  providers/                      pluggable audit providers
    base.ts                       abstract AuditProvider + chatJSON()
    openai.ts                     OpenAI audit provider
    gemini.ts                     Gemini audit provider
    claude.ts                     Claude audit provider
    codex.ts                      Codex audit provider
    model-tiers.ts                model tier utilities
    index.ts                      createAuditProvider() factory
  errors/
    index.ts                      InvalidTransitionError, ProviderError
  types/
    index.ts                      barrel — re-exports all schemas + types
    assets.d.ts                   .md text import declaration for Bun
    schema/                       all Zod schemas (issue, config, lock, mode, etc.)
  utils/
    execFileNoThrow.ts            shell-injection-safe subprocess (Bun.spawn)
    logger.ts                     pino logger (JSON stderr + log file)
    toError.ts                    unknown → Error coercion
    syncToResultAsync.ts          sync → ResultAsync bridge
    sentry.ts                     Sentry error tracking wrapper
  prompts/
    PROMPT_plan.md                planning prompt template
    PROMPT_build.md               build prompt template
    PROMPT_split.md               split prompt template
    PROMPT_audit.md               audit prompt template
    PROMPT_triage.md              triage prompt template
    PROMPT_interview.md           interactive interview prompt
    PROMPT_interview_eval.md      interview evaluation prompt
tools/
  dashboard/                      web dashboard (Bun HTTP + SSE + WebSocket)
    server.ts                     Bun HTTP server entry (port 3333)
    routes/api.ts                 REST handlers (CRUD, interview, config)
    routes/sse.ts                 SSE streaming (command output, log tailing)
    routes/ws.ts                  WebSocket interview subprocess
    services/issue-service.ts     DI container (provider + config)
    services/log-reader.ts        JSONL tail with byte-offset tracking
    services/activity-aggregator.ts  SDK message → ActivityEntry parser
    frontend/                     Preact + @preact/signals + DaisyUI + Tailwind
    build.ts                      Bun bundler + Tailwind CLI
  playground-server.ts            legacy development playground server
tests/
  unit/                           488 tests across 42 files
  fixtures/                       test helpers (mock provider, etc.)
  sample-project/                 git submodule for manual testing
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

- **State machine**: `IssueState` transitions are validated by `VALID_TRANSITIONS` in `types/schema/issue-schema.ts` — never mutate state directly, use `validateTransition()`. States: `NEW → GROOMED → PLANNED → IN_PROGRESS → COMPLETED → VERIFIED`, with `STUCK` and `SPLIT` as side-states. `GROOMED` is set by triage when `needs_interview=false`. `VERIFIED` is the true terminal state (post-verification). `SPLIT` is terminal (children take over).
- **No globals**: ISSUE_ID/MODE/ISSUE_STATE were the bash bugs; pass state as function args.
- **Issue files**: Frontmatter markdown (`KEY=VALUE`) in `issuesDir`, not SQLite — git-trackable.
- **Claude integration**: Main orchestration (plan/build/split) uses `@anthropic-ai/claude-agent-sdk` directly with `permissionMode: 'bypassPermissions'` and auto-compact disabled. Triage uses the `claude` CLI subprocess for one-shot calls.
- **Context monitoring**: Async iterator on SDK stream messages; tracks input tokens from main-context assistant messages only (`parent_tool_use_id === null`). Throws `ContextOverflowError` when threshold exceeded.
- **Stream logging**: When `DISABLE_LOG_STREAM` is not set, raw JSONL is appended per-issue to `.barf/streams/{issueId}.jsonl`. Useful for debugging Claude output.
- **Path aliases**: Use `@/` for `src/` imports, `@tests/` for `tests/` imports, `@tools/` for `tools/`, `@dashboard/` for `tools/dashboard/` — no relative `../` paths.
- **Error handling**: All I/O returns `Result`/`ResultAsync` from neverthrow — no thrown errors except at CLI boundary (`src/index.ts`). Error classes: `InvalidTransitionError`, `ProviderError`, `ContextOverflowError`, `RateLimitError`.
- **Logging**: Never use `console.*` — always use `createLogger(name)` from `@/utils/logger` (pino, JSON to stderr + log file). Use `LOG_PRETTY=1` in dev for readable output. Prefer structured context: `logger.info({ key: val }, 'message')` over string interpolation.
- **Dependency injection**: All core functions accept injectable dependencies (`RunLoopDeps`, `AutoDeps`, `AuditDeps`, `ExecFn`) for testability. Real implementations are defaults; mocks are passed in tests.
- **Zod schemas**: Single source of truth for types — never define interfaces separately. All schemas in `src/types/schema/`. Zod 4.x required.
- **TypeScript**: Strict mode, no `any` types, explicit return types on exported functions.
- **Prompt templates**: Embedded at compile time via Bun import attributes (`with { type: 'text' }`). Re-read from `PROMPT_DIR` per iteration when set, allowing live editing during long runs.
- **Testing**: 488 tests across 42 files using `bun:test`. Test behavior, not implementation. All core functions testable via DI.
- **Dashboard**: Preact + `@preact/signals` + DaisyUI/Tailwind frontend served by Bun HTTP. SSE for command streaming, WebSocket for interactive interview. Built via `bun run dashboard:build`.
