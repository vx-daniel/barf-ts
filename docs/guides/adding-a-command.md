# Adding a CLI Command

This guide walks through adding a new command to barf, following the pattern established by existing commands like `plan` and `build`.

## File Structure

Each command lives in its own file under `src/cli/commands/`:

```
src/cli/commands/
  index.ts          # barrel — re-exports all commands
  init.ts
  status.ts
  plan.ts
  build.ts
  auto.ts
  audit.ts
  your-command.ts   # ← new file
```

## Step 1: Create the Command Function

Create `src/cli/commands/your-command.ts`. Every command function follows the same signature pattern:

```typescript
/** @module CLI Commands */
import type { IssueProvider } from '@/core/issue/base'
import type { Config } from '@/types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('your-command')

/**
 * Does the thing.
 *
 * @param provider - Issue provider supplying and persisting issues.
 * @param opts - Command-specific options.
 * @param config - Loaded barf configuration.
 */
export async function yourCommand(
  provider: IssueProvider,
  opts: { issue?: string },
  config: Config,
): Promise<void> {
  // 1. Resolve issue ID (auto-select or explicit)
  let issueId = opts.issue
  if (!issueId) {
    const result = await provider.autoSelect('build') // or 'plan'
    if (result.isErr()) {
      logger.error({ err: result.error }, result.error.message)
      process.exit(1)
    }
    if (!result.value) {
      logger.info('No issues available.')
      return
    }
    issueId = result.value.id
  }

  // 2. Do work
  logger.info({ issueId }, 'Starting your-command')
  // ...

  logger.info({ issueId }, 'Done')
}
```

Key conventions:
- **No globals** — all state flows through function args (`provider`, `config`, `opts`)
- **Logger, not console** — use `createLogger('name')` from `@/utils/logger`
- **Exit codes** — set `process.exit(1)` on fatal errors; let the function return on success
- **`@module CLI Commands`** — tag for TypeDoc grouping

## Step 2: Export from the Barrel

Add to `src/cli/commands/index.ts`:

```typescript
export * from './your-command'
```

## Step 3: Register in the CLI

Add the commander subcommand in `src/index.ts`:

```typescript
program
  .command('your-command')
  .description('Does the thing')
  .option('--issue <id>', 'Issue ID (auto-selects if omitted)')
  .action(async (opts) => {
    const config = loadConfig(program.opts().config)
    const provider = getProvider(config)
    await yourCommand(provider, { issue: opts.issue }, config)
  })
```

The `loadConfig` / `getProvider` boilerplate is the same for every command. The `preAction` hook in `src/index.ts` handles `--cwd` and `--config` resolution before your action runs.

## Step 4: Write Tests

Tests go in `tests/unit/cli/commands/your-command.test.ts`. Use the mock provider from `tests/fixtures/`:

```typescript
import { describe, it, expect } from 'bun:test'
import { yourCommand } from '@/cli/commands/your-command'
// Import or create a mock IssueProvider
```

Test the command function directly — don't test through commander. The command function is a plain async function that takes typed args.

## Checklist

- [ ] Command file in `src/cli/commands/` with `@module CLI Commands` tag
- [ ] Exported from `src/cli/commands/index.ts`
- [ ] Registered as a subcommand in `src/index.ts`
- [ ] Uses `createLogger('name')` — no `console.*`
- [ ] Accepts `IssueProvider`, options object, and `Config` as args
- [ ] TSDoc comment on the exported function
- [ ] Unit tests in `tests/unit/cli/commands/`
