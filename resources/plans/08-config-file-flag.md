# --config Flag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global `--config <path>` CLI flag that lets callers point `barf` at an arbitrary `.barfrc` file instead of always reading `<cwd>/.barfrc`.

**Architecture:** Change `loadConfig(projectDir)` → `loadConfig(rcPath?)` so it accepts an explicit file path. Add a global Commander option and thread it through the four command action handlers. Composes with `--cwd`: Commander's `preAction` hook runs `process.chdir` before any action, so relative `--config` paths naturally resolve against the new cwd.

**Tech Stack:** Bun, TypeScript, Commander.js, neverthrow, Zod.

---

### Task 1: Update `loadConfig` signature and path resolution

**Files:**
- Modify: `src/core/config.ts`
- Test: `tests/unit/config.test.ts`

**Step 1: Write failing tests for `loadConfig`**

Add to `tests/unit/config.test.ts` (after the existing `parseBarfrc` suite):

```ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadConfig } from '@/core/config'

describe('loadConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'barf-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true })
  })

  it('reads config from explicit file path', () => {
    const rcPath = join(tmpDir, 'custom.rc')
    writeFileSync(rcPath, 'ISSUES_DIR=custom-issues\n')
    const config = loadConfig(rcPath)
    expect(config.issuesDir).toBe('custom-issues')
  })

  it('falls back to defaults when explicit file does not exist', () => {
    const config = loadConfig(join(tmpDir, 'nonexistent.rc'))
    expect(config.issuesDir).toBe('issues')
  })

  it('falls back to defaults when called with no args', () => {
    // no .barfrc in tmpDir; cwd is not tmpDir, but defaults are still predictable
    const config = loadConfig()
    expect(config.issuesDir).toBe('issues')
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
bun test tests/unit/config.test.ts
```

Expected: 3 failures — `loadConfig` does not yet accept a file path.

**Step 3: Update `loadConfig` in `src/core/config.ts`**

Change the import line from:
```ts
import { join } from 'path'
```
to:
```ts
import { join, resolve } from 'path'
```

Replace the `loadConfig` function:

```ts
/**
 * Loads barf configuration from a `.barfrc` file.
 *
 * Falls back to schema defaults if the file is missing or cannot be parsed.
 * Never throws — invalid config is silently replaced with defaults.
 *
 * @param rcPath - Path to the `.barfrc` file. Defaults to `<cwd>/.barfrc`.
 */
export function loadConfig(rcPath?: string): Config {
  const filePath = rcPath ? resolve(rcPath) : join(process.cwd(), '.barfrc')
  try {
    const content = readFileSync(filePath, 'utf8')
    return parseBarfrc(content).match(
      config => config,
      () => RawConfigSchema.parse({})
    )
  } catch {
    return RawConfigSchema.parse({})
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
bun test tests/unit/config.test.ts
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/core/config.ts tests/unit/config.test.ts
git commit -m "feat: loadConfig accepts explicit file path instead of directory"
```

---

### Task 2: Add `--config` global option and wire up call sites

**Files:**
- Modify: `src/index.ts`

**Step 1: Add the global option**

In `src/index.ts`, add `.option('--config <path>', ...)` after the existing `--cwd` option:

```ts
program
  .name('barf')
  .description('AI issue orchestration CLI')
  .version('2.0.0')
  .option('--cwd <path>', 'Project directory (default: current directory)')
  .option('--config <path>', 'Path to .barfrc config file (default: <cwd>/.barfrc)')
  .hook('preAction', () => {
    const cwd = program.opts().cwd
    if (cwd) process.chdir(resolve(cwd))
  })
```

**Step 2: Thread `--config` through the four command actions**

Each command action currently calls `loadConfig()`. Change every call site to `loadConfig(program.opts().config)`.

`init` action:
```ts
const config = loadConfig(program.opts().config)
```

`status` action:
```ts
const config = loadConfig(program.opts().config)
```

`plan` action:
```ts
const config = loadConfig(program.opts().config)
```

`build` action:
```ts
const config = loadConfig(program.opts().config)
```

**Step 3: Verify help output**

```bash
bun run dev --help
```

Expected output includes:
```
  --config <path>  Path to .barfrc config file (default: <cwd>/.barfrc)
```

**Step 4: Smoke test the flag**

```bash
echo "BUILD_MODEL=claude-haiku-4-5-20251001" > /tmp/test.barfrc
bun run dev --config /tmp/test.barfrc status
# Should not error; config is loaded from /tmp/test.barfrc

bun run dev --cwd /tmp --config /tmp/test.barfrc status
# --cwd and --config both apply independently
```

**Step 5: Run full test suite**

```bash
bun test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: add --config global option to specify .barfrc path"
```
