# Configuration System

**Source:** `src/core/config.ts`, `src/types/schema/config-schema.ts`

barf is configured via a `.barfrc` file in `KEY=VALUE` format (shell-style, no quotes needed for simple values).

## Loading

```typescript
loadConfig(path?: string): Config
// Searches for .barfrc in cwd → parent dirs → home dir
// Never throws; falls back to all defaults if not found
// parseBarfrc(content) → Result<Config, ZodError>
```

## Key Settings

### Paths

```ini
issuesDir=./issues          # where issue .md files live
planDir=./plans             # where plan files live
barfDir=./.barf             # lock files, stream logs, temp files
promptDir=./prompts         # optional: custom prompt overrides
logFile=./.barf/barf.log    # pino log output
```

### AI Models

```ini
triageModel=claude-haiku-4-5        # one-shot triage
planModel=claude-sonnet-4-5         # planning iterations
buildModel=claude-sonnet-4-5        # build iterations
splitModel=claude-sonnet-4-5        # generating split child issues
extendedContextModel=claude-opus-4  # after maxAutoSplits exhausted
auditModel=claude-sonnet-4-5        # audit evaluation
```

### Context & Iteration Control

```ini
contextUsagePercent=75      # interrupt Claude at 75% of context window
maxAutoSplits=3             # split up to 3 times before escalating to extendedContextModel
maxIterations=0             # 0 = unlimited; N = cap iterations per runLoop call
claudeTimeout=300000        # ms before aborting an iteration (default: 5 min)
```

### Issue Provider

```ini
issueProvider=local         # 'local' (default) or 'github'
githubRepo=owner/repo       # required when issueProvider=github
```

### Pre-Completion Gates

```ini
fixCommands=bun run lint --fix,bun run format   # comma-separated, best-effort
testCommand=bun test                             # must pass to complete
```

### Audit

```ini
auditProvider=claude        # 'openai' | 'gemini' | 'claude' | 'codex'
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
```

### Misc

```ini
pushStrategy=none           # 'none' | 'auto' — auto-push after VERIFIED
disableLogStream=false      # disable per-issue JSONL stream logging
STREAM_LOG_DIR=.barf/streams  # set to enable stream logging
LOG_PRETTY=1                # human-readable pino output (dev)
LOG_LEVEL=info              # pino log level
```

## Schema (`src/types/schema/config-schema.ts`)

`ConfigSchema` is a Zod object schema. All fields have defaults — a missing `.barfrc` yields a valid Config. The config is validated once at startup; failures are logged and defaults used.

## Environment Fallbacks

- `ANTHROPIC_API_KEY` — also read from env var
- `OPENAI_API_KEY` — also checked in `~/.codex/auth.json`
- `LOG_PRETTY`, `LOG_LEVEL` — only from env (not in .barfrc)

## Per-Issue Overrides

Some config values can be overridden per-issue in frontmatter:

```yaml
context_usage_percent: 60   # override contextUsagePercent for this issue only
```
