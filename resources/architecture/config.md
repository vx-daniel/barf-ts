# Configuration System

**Source:** `src/core/config.ts`, `src/types/schema/config-schema.ts`

barf is configured via a `.barfrc` file in `KEY=VALUE` format (shell-style, no quotes needed for simple values).

## Loading

```typescript
loadConfig(path?: string): Result<Config, Error>
// Reads .barfrc from specified path or cwd
// parseBarfrc(content) → key-value pairs → ConfigSchema.parse()
// All fields have defaults — missing .barfrc yields a valid Config
```

## Settings by Category

### Paths

| Key | Default | Description |
|-----|---------|-------------|
| `ISSUES_DIR` | `issues` | Where issue `.md` files live |
| `PLAN_DIR` | `plans` | Where plan files are saved |
| `BARF_DIR` | `.barf` | Lock files, stream logs, temp files |
| `PROMPT_DIR` | `""` | Custom prompt overrides (empty = built-in) |
| `LOG_FILE` | `.barf/barf.jsonl` | Pino log output file |

### AI Models

| Key | Default | Description |
|-----|---------|-------------|
| `TRIAGE_MODEL` | `claude-haiku-4-5-20251001` | One-shot triage (CLI subprocess) |
| `PLAN_MODEL` | `claude-opus-4-6` | Planning iterations (SDK) |
| `BUILD_MODEL` | `claude-sonnet-4-6` | Build iterations (SDK) |
| `SPLIT_MODEL` | `claude-sonnet-4-6` | Split child issue generation (SDK) |
| `EXTENDED_CONTEXT_MODEL` | `claude-opus-4-6` | After maxAutoSplits exhausted (SDK) |

### Context & Iteration Control

| Key | Default | Description |
|-----|---------|-------------|
| `CONTEXT_USAGE_PERCENT` | `75` | Interrupt Claude at this % of context window (1–100) |
| `MAX_AUTO_SPLITS` | `3` | Split up to N times before escalating |
| `MAX_ITERATIONS` | `0` | Cap iterations per runLoop call (0 = unlimited) |
| `MAX_VERIFY_RETRIES` | `3` | Max verification attempts before giving up |
| `CLAUDE_TIMEOUT` | `3600` | Seconds before aborting an iteration |

### Issue Provider

| Key | Default | Description |
|-----|---------|-------------|
| `ISSUE_PROVIDER` | `local` | `local` or `github` |
| `GITHUB_REPO` | `""` | `owner/repo` — required when `ISSUE_PROVIDER=github` |

### Pre-Completion Gates

| Key | Default | Description |
|-----|---------|-------------|
| `FIX_COMMANDS` | `""` | Comma-separated, best-effort (e.g. `biome check --apply`) |
| `TEST_COMMAND` | `""` | Must pass to complete (e.g. `bun test`) |
| `PUSH_STRATEGY` | `iteration` | `iteration` / `on_complete` / `manual` |

### Audit

| Key | Default | Description |
|-----|---------|-------------|
| `AUDIT_PROVIDER` | `openai` | `openai` / `gemini` / `claude` / `codex` |
| `AUDIT_MODEL` | `gpt-4o` | OpenAI audit model |
| `CLAUDE_AUDIT_MODEL` | `claude-sonnet-4-6` | Claude audit provider model |
| `GEMINI_MODEL` | `gemini-1.5-pro` | Gemini audit provider model |
| `OPENAI_API_KEY` | `""` | Also reads `~/.codex/auth.json` |
| `GEMINI_API_KEY` | `""` | Required for `AUDIT_PROVIDER=gemini` |
| `ANTHROPIC_API_KEY` | `""` | Required for `AUDIT_PROVIDER=claude` |

### Logging

| Key | Default | Description |
|-----|---------|-------------|
| `LOG_LEVEL` | `info` | Pino log level |
| `LOG_PRETTY` | `false` | Human-readable output (dev only) |
| `DISABLE_LOG_STREAM` | `false` | Disable per-issue JSONL stream logs |

### Observability

| Key | Default | Description |
|-----|---------|-------------|
| `SENTRY_DSN` | `""` | Sentry error tracking (empty = disabled) |
| `SENTRY_ENVIRONMENT` | `development` | Sentry environment tag |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.2` | Sentry tracing sample rate (0.0–1.0) |

## Schema

`ConfigSchema` is a Zod 4 object schema in `src/types/schema/config-schema.ts`. All fields have defaults — a missing `.barfrc` yields a valid Config. The schema validates at load time; parse errors are reported and defaults used.

## Per-Issue Overrides

Some config values can be overridden per-issue in frontmatter:

| Frontmatter Field | Overrides | Effect |
|-------------------|-----------|--------|
| `context_usage_percent` | `CONTEXT_USAGE_PERCENT` | Raise/lower context threshold for one issue |

## Environment Variable Fallbacks

- `LOG_PRETTY` and `LOG_LEVEL` can be set as env vars (override `.barfrc`)
- `OPENAI_API_KEY` falls back to `~/.codex/auth.json` if not in `.barfrc`
- `ANTHROPIC_API_KEY` also read from environment
