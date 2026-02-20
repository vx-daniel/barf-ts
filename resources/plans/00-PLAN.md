# barf v2 — TypeScript/Bun Rewrite

> Future work. Current bash implementation in `/home/daniel/Projects/barf-loop/src/` remains production until this is complete.

## Why

The bash implementation hits four hard limits:
- **Global mutable state** — `ISSUE_ID`, `MODE`, `ISSUE_STATE` are shared globals; `loop_plan_split_children` mutates them and must manually save/restore (the transient-churning bug is a symptom)
- **Untestable architecture** — BATS tests awk-extract functions from the main script and eval them into test scope; this is a sign the architecture is fighting testability
- **Fragile context monitoring** — background subprocess + temp-file IPC + SIGTERM; 100 lines to do what an async iterator does in 15
- **JSON parsing overhead** — 2 jq forks per stream-json line

## Stack

| Choice | Rationale |
|--------|-----------|
| **Bun** | Single binary via `bun build --compile`, fast startup, built-in test runner, native TypeScript |
| **TypeScript** | Typed state machine makes transition bugs impossible, proper error propagation |
| **commander** | Battle-tested CLI arg parsing |
| **chalk + ora** | Stable TUI primitives (Phase 1); OpenTUI v0.1.x is too unstable |
| **`.barfrc` compat** | Regex parse, no migration friction for existing projects |

## Architecture

### Directory structure

```
barf-ts/
├── src/
│   ├── index.ts               # CLI entry point
│   ├── cli/
│   │   └── commands/          # plan.ts  build.ts  status.ts  init.ts  doctor.ts
│   ├── core/
│   │   ├── issue.ts           # Frontmatter parser, typed state machine, file locking
│   │   ├── context.ts         # Async stream parser, overflow detection
│   │   ├── claude.ts          # Claude subprocess wrapper, prompt injection
│   │   ├── config.ts          # .barfrc bash-compat parser
│   │   └── batch.ts           # Batch orchestration loop
│   ├── hooks/
│   │   └── install.ts         # Writes .claude/settings.json hook entries
│   └── types/
│       └── index.ts           # Issue, Config, IssueState, ClaudeEvent
└── tests/
    ├── unit/                  # issue.test.ts  context.test.ts  batch.test.ts
    └── integration/           # workflow.test.ts
```

### Key decisions

**Keep frontmatter files (not SQLite)**
Issues are git-trackable markdown. `barf status` diffs are human-readable. A mtime-invalidated in-memory Map is sufficient for state caching — SQLite is overkill.

**Async stream parser for context monitoring (not PostToolUse hooks)**
PostToolUse hooks fire after each tool completes — not granular enough for real-time token tracking. The stream-json async iterator approach (designed in `../docs/plans/25-typescript-opentui-rewrite.md`) is correct and clean.

**Claude Code hooks for quality gates**
PreToolUse hooks intercept `git commit` calls and enforce test passage. Stop hooks transition issue state on session end. These replace quality-gate logic currently baked into prompts.

## State Machine

```typescript
type IssueState = 'NEW' | 'INTERVIEWED' | 'PLANNED' | 'IN_PROGRESS' | 'STUCK' | 'SPLIT' | 'COMPLETED';

const VALID_TRANSITIONS: Record<IssueState, IssueState[]> = {
  NEW: ['PLANNED'],
  PLANNED: ['IN_PROGRESS', 'STUCK', 'SPLIT'],
  IN_PROGRESS: ['COMPLETED', 'STUCK', 'SPLIT'],
  SPLIT: [],
  STUCK: ['PLANNED', 'SPLIT'],
  COMPLETED: [],
};

function transition(issue: Issue, to: IssueState): Issue {
  if (!VALID_TRANSITIONS[issue.state].includes(to)) {
    throw new InvalidTransitionError(issue.state, to);
  }
  return { ...issue, state: to };
}
```

The `loop_plan_split_children` ISSUE_ID bug is impossible here — no globals, just function arguments.

## Context Monitoring

```typescript
async function* parseClaudeStream(proc: Subprocess): AsyncGenerator<ClaudeEvent> {
  for await (const line of proc.stdout) {
    const event = JSON.parse(line);
    const tokens = extractCacheTokens(event);  // cache_creation + cache_read
    if (tokens) yield { type: 'usage', tokens };
    const tool = extractToolName(event);
    if (tool) yield { type: 'tool', name: tool };
  }
}

// In run_loop:
for await (const event of parseClaudeStream(proc)) {
  if (event.type === 'usage' && event.tokens >= threshold) {
    proc.kill('SIGTERM');
    throw new ContextOverflow(event.tokens);
  }
  if (event.type === 'tool') updateSpinner(event.name);
}
```

Replaces `src/lib/context.sh` (~475 lines) with ~30 lines.

## Hooks Integration

`barf init` writes two hooks to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "barf-hook-precommit" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "barf-hook-stop" }] }]
  }
}
```

- **`barf-hook-precommit`** — intercepts `git commit` Bash calls, runs tests, blocks if failing
- **`barf-hook-stop`** — reads `.barf/session_result.json` (written by Claude's final output), transitions issue state

## Phases

### v2.0 — Core CLI
- [ ] Project setup: `package.json`, `tsconfig.json`, `bunfig.toml`
- [ ] `.barfrc` parser (regex, bash-compat)
- [ ] `issue.ts`: frontmatter parser, typed state machine, `.working` file lock
- [ ] `context.ts`: async stream parser, SIGTERM on overflow
- [ ] `claude.ts`: subprocess spawning, prompt template injection
- [ ] `batch.ts`: orchestration loop, auto-plan-split-children (correct by construction)
- [ ] Commands: `init`, `plan`, `build`, `status`, `doctor`
- [ ] Tests: `bun test`, ~80% coverage on core modules
- [ ] Build: `bun build --compile --outfile=dist/barf src/index.ts`

### v2.1 — Hooks
- [ ] `barf-hook-precommit` binary (pre-commit quality gate)
- [ ] `barf-hook-stop` binary (state transition on session end)
- [ ] `barf init` installs hooks automatically

### v3.0 — MCP Server (future)
- [ ] `src/mcp/server.ts` wraps core library with MCP tool definitions
- [ ] Tools: `plan_issue`, `build_issue`, `get_status`, `split_issue`
- [ ] Same core library, different interface — CLI and MCP coexist

## Verification

```bash
# Build
bun build --compile --outfile=dist/barf src/index.ts

# Tests
bun test

# Integration smoke test
./dist/barf init
./dist/barf plan --issue=001
./dist/barf build --issue=001 --max=2
./dist/barf status --format=json

# Batch
./dist/barf build --batch=3 --max=2

# Parity check vs bash
diff <(./dist/barf status) <(../src/barf status)
```

## Reference files in current bash implementation

| File | What to port |
|------|-------------|
| `/home/daniel/Projects/barf-loop/src/barf:620-750` | `run_loop`, `loop_handle_overflow`, `loop_plan_split_children` — study the state bugs, don't repeat them |
| `/home/daniel/Projects/barf-loop/src/lib/context.sh` | Stream parser logic → `context.ts` async iterator |
| `/home/daniel/Projects/barf-loop/src/lib/issue.sh` | Frontmatter parser, state machine, `.working` lock → `issue.ts` |
| `/home/daniel/Projects/barf-loop/src/lib/config.sh` | `.barfrc` parsing contract → `config.ts` |
| `/home/daniel/Projects/barf-loop/docs/plans/25-typescript-opentui-rewrite.md` | Prior TypeScript architecture — stream parser design is reusable |
