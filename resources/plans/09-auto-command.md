# Plan 09 — Auto Command

## Context

`npm run run:local` exits with code 1 and prints help because the script passes `--config` and `--cwd` flags but no subcommand. Commander.js requires a subcommand.

The user wants a default mode that automatically:
1. Plans all NEW issues (sequential, one at a time)
2. Builds all PLANNED/PLANNED issues (concurrent batch)
3. Repeats until no actionable issues remain

## Root Cause

`package.json` line 8:
```
"run:local": "bun run src/index.ts --config tests/sample-project/.barfrc.local --cwd tests/sample-project"
```
Missing subcommand → Commander prints help, exits 1.

## Implementation

### 1. Create `src/cli/commands/auto.ts`

```typescript
import type { Config } from '@/types'
import type { IssueProvider } from '@/core/issue-providers/base'
import { runLoop } from '@/core/batch'

const PLAN_STATES = new Set(['NEW'])
const BUILD_STATES = new Set(['PLANNED', 'PLANNED'])

export async function autoCommand(
  provider: IssueProvider,
  opts: { batch: number; max: number },
  config: Config
): Promise<void> {
  while (true) {
    const listResult = await provider.listIssues()
    if (listResult.isErr()) break

    const issues = listResult.value
    const toPlan = issues.filter(i => PLAN_STATES.has(i.state))
    const toBuild = issues.filter(i => BUILD_STATES.has(i.state)).slice(0, opts.batch)

    if (toPlan.length === 0 && toBuild.length === 0) break

    // Phase 1: plan NEW issues sequentially
    for (const issue of toPlan) {
      await runLoop(issue.id, 'plan', config, provider)
    }

    // Phase 2: build PLANNED/PLANNED concurrently (up to batch limit)
    if (toBuild.length > 0) {
      await Promise.allSettled(toBuild.map(i => runLoop(i.id, 'build', config, provider)))
    }
  }
}
```

### 2. Register command in `src/index.ts`

Add import:
```typescript
import { autoCommand } from '@/cli/commands/auto'
```

Add command before `program.parseAsync(...)`:
```typescript
program
  .command('auto')
  .description('Auto-orchestrate: plan all NEW then build all PLANNED/PLANNED')
  .option('--batch <n>', 'Max concurrent builds', parseInt)
  .option('--max <n>', 'Max iterations per issue (0 = unlimited)', parseInt)
  .action(async opts => {
    const config = loadConfig(program.opts().config)
    const provider = getProvider(config)
    await autoCommand(provider, { batch: opts.batch ?? 1, max: opts.max ?? 0 }, config)
  })
```

### 3. Update `package.json` scripts

```json
"run:local": "bun run src/index.ts --config tests/sample-project/.barfrc.local --cwd tests/sample-project auto",
"run:gh":    "bun run src/index.ts --config tests/sample-project/.barfrc.github --cwd tests/sample-project auto",
```

## Critical Files

| File | Change |
|------|--------|
| `src/cli/commands/auto.ts` | New file |
| `src/index.ts` | Add import + command registration |
| `package.json` | Append `auto` to `run:local` and `run:gh` |

## Reused APIs

- `runLoop(issueId, mode, config, provider)` — `src/core/batch.ts:105` (exported)
- `provider.listIssues()` — returns `ResultAsync<Issue[]>`
- `loadConfig(path)` — `src/core/config.ts`
- `getProvider(config)` — already in `src/index.ts`

## Verification

```bash
# Quick smoke test — should list issues then start planning/building
npm run run:local

# Confirm exit 0
npm run run:local; echo "Exit: $?"

# Run unit tests
bun test
```
