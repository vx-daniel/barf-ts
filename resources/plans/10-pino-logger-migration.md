# Plan: Pino Logger Migration

## Context

The codebase has two logging approaches in use:
- **CLI commands** (`init.ts`, `plan.ts`, `build.ts`, `status.ts`, `index.ts`): ~25 `console.info/error` calls for user-facing output
- **Core modules** (`batch.ts`, `claude.ts`): use `createLogger(name)` from `@/utils/logger` (pino)

This inconsistency means CLI output bypasses the structured logging system entirely, making it impossible to route, filter, or suppress CLI-layer output via `LOG_LEVEL` or log-file settings. The goal is to consolidate on pino everywhere and document the convention in CLAUDE.md.

Tests are excluded from this migration.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/cli/commands/init.ts` | Add logger, replace 6 console calls |
| `src/cli/commands/plan.ts` | Add logger, replace 5 console calls |
| `src/cli/commands/build.ts` | Add logger, replace 9 console calls |
| `src/cli/commands/status.ts` | Add logger, replace 4 console calls |
| `src/index.ts` | Replace 1 console.error with root `logger` |
| `CLAUDE.md` | Add logging convention to Key Conventions |

---

## Implementation Steps

### 1. `src/cli/commands/init.ts`

Add at top:
```typescript
import { createLogger } from '@/utils/logger'
const logger = createLogger('init')
```

Replacements:
- `console.info(...)` → `logger.info(...)` (lines 20, 24, 43, 58, 61)
- `console.error(...)` → `logger.error(...)` (line 41)

Prefer structured context over string interpolation:
```typescript
// Before: console.info(`Created ${config.issuesDir}/ and ${config.planDir}/`)
logger.info({ issuesDir: config.issuesDir, planDir: config.planDir }, 'Directories created')

// Before: console.error(`  ✗ ${label.name}: ${result.stderr.trim()}`)
logger.error({ label: label.name, stderr: result.stderr.trim() }, 'Label creation failed')
```

### 2. `src/cli/commands/plan.ts`

Add at top:
```typescript
import { createLogger } from '@/utils/logger'
const logger = createLogger('plan')
```

Replacements:
- `console.info(...)` → `logger.info(...)` (lines 19, 25, 31)
- `console.error(...)` → `logger.error(...)` (lines 15, 28)

### 3. `src/cli/commands/build.ts`

Add at top:
```typescript
import { createLogger } from '@/utils/logger'
const logger = createLogger('build')
```

Replacements:
- `console.info(...)` → `logger.info(...)` (lines 14, 20, 35, 39, 55)
- `console.error(...)` → `logger.error(...)` (lines 17, 27, 49, 52)

### 4. `src/cli/commands/status.ts`

Add at top:
```typescript
import { createLogger } from '@/utils/logger'
const logger = createLogger('status')
```

Replacements:
- `console.info(...)` → `logger.info(...)` (lines 14, 18, 22)
- `console.error(...)` → `logger.error(...)` (line 9)

Note: `status.ts:14` currently does `JSON.stringify(issues, null, 2)` — pass `issues` as context:
```typescript
// Before: console.info(JSON.stringify(issues, null, 2))
logger.info({ issues }, 'Issues list')
```

### 5. `src/index.ts`

Import root logger (already exported from `@/utils/logger`) instead of a new `createLogger` call:
```typescript
import { logger } from '@/utils/logger'
```

Replace:
```typescript
// Before:
console.error(`Error: ${e.message}`)
// After:
logger.error({ err: e }, e.message)
```

### 6. `CLAUDE.md` — Key Conventions

Add to the Key Conventions bullet list:
```
- **Logging**: Never use `console.*` — always use `createLogger(name)` from `@/utils/logger`
  (pino, JSON to stderr + log file). Use `LOG_PRETTY=1` in dev for readable output.
```

---

## Pino Structured Logging Style

When migrating, prefer structured context over string interpolation:

```typescript
// WRONG — string interpolation loses structure
logger.info(`Building issue ${opts.issue}...`)

// CORRECT — context object + message
logger.info({ issueId: opts.issue }, 'Building issue')
```

This is consistent with how `batch.ts`/`claude.ts` already log.

---

## Verification

1. **Build passes**: `bun run build` — no TypeScript errors
2. **Tests pass**: `bun test` — all 64 unit tests green
3. **Lint clean**: `bun run check` — no violations
4. **Grep confirms clean**: `grep -r 'console\.' src/` returns zero matches
5. **Manual smoke test**:
   ```bash
   LOG_PRETTY=1 bun run dev plan   # pino pretty-printed output visible
   LOG_PRETTY=1 bun run dev status # structured log lines visible
   LOG_LEVEL=error bun run dev status  # info lines suppressed
   ```
