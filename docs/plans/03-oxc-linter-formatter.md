# OXC Linter + Formatter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add oxlint (fast Rust-based linter) and oxfmt (OXC formatter) to enforce code quality and consistent style across the barf-ts codebase.

**Architecture:** Single toolchain — the OXC project provides both `oxlint` (linter) and `oxfmt` (formatter), both written in Rust and significantly faster than their JavaScript equivalents. Both run as `bun run lint` / `bun run format`. The `check` script runs both in sequence for use by CI and `barf-hook-precommit`.

**Note:** This plan assumes `package.json` already exists (from `02-issue-provider-plugin-system.md` Task 1). If starting fresh, run Task 1 of plan 02 first.

---

### Task 1: Install dependencies

**Step 1: Install oxlint and oxfmt**

Run: `bun add -d oxlint @oxc/oxfmt`
Expected: Both added to `devDependencies` in `package.json`

If `@oxc/oxfmt` is not yet published, use only `oxlint` and skip formatter steps — add a TODO comment in `package.json` scripts for `format`.

**Step 2: Verify installs**

Run: `bunx oxlint --version`
Expected: Prints version string

**Step 3: Commit**
```bash
git add package.json bun.lock
git commit -m "chore: add oxlint and oxfmt"
```

---

### Task 2: oxlint configuration

**Files:**
- Create: `.oxlintrc.json`

**Step 1: Create `.oxlintrc.json`**
```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "rules": {
    "no-unused-vars": "error",
    "no-console": "off",
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "error"
  },
  "env": {
    "node": true
  },
  "ignorePatterns": [
    "dist/",
    "node_modules/"
  ]
}
```

**Step 2: Run oxlint against the codebase**

Run: `bunx oxlint src/ tests/`
Expected: Clean output or a list of fixable violations

**Step 3: Fix any reported issues**

Run: `bunx oxlint --fix src/ tests/`

Then manually address anything auto-fix couldn't handle. Common issues:
- `no-var` → replace `var` with `const`/`let`
- `prefer-const` → change `let` to `const` where never reassigned
- `eqeqeq` → replace `==` / `!=` with `===` / `!==`

Run `bunx oxlint src/ tests/` again to confirm zero errors.

**Step 4: Commit**
```bash
git add .oxlintrc.json
git add -u src/ tests/
git commit -m "chore: add oxlint config and fix lint violations"
```

---

### Task 3: oxfmt configuration

Skip this task if `@oxc/oxfmt` was not available in Task 1.

**Files:**
- Create: `oxfmt.toml` (or whatever config filename oxfmt uses — check `bunx oxfmt --help`)

**Step 1: Create formatter config**
```toml
# oxfmt.toml
print_width = 100
tab_width = 2
use_tabs = false
single_quote = true
trailing_comma = "all"
```

**Step 2: Run formatter**

Run: `bunx oxfmt src/ tests/`
Expected: Files formatted in-place

**Step 3: Verify no diff beyond formatting**

Run: `git diff src/ tests/`
Expected: Only whitespace/style changes — no logic changes

**Step 4: Commit**
```bash
git add oxfmt.toml
git add -u src/ tests/
git commit -m "chore: add oxfmt config and format existing files"
```

---

### Task 4: Add scripts to package.json

**Files:**
- Modify: `package.json`

**Step 1: Update scripts section**
```json
"scripts": {
  "test": "bun test",
  "build": "bun build --compile --outfile=dist/barf src/index.ts",
  "lint": "oxlint src/ tests/",
  "lint:fix": "oxlint --fix src/ tests/",
  "format": "oxfmt src/ tests/",
  "format:check": "oxfmt --check src/ tests/",
  "check": "bun run lint && bun run format:check"
}
```

If oxfmt is not yet available, omit `format` and `format:check` and set `"check": "bun run lint"`.

**Step 2: Verify `check` runs cleanly**

Run: `bun run check`
Expected: Zero lint errors, zero format violations

**Step 3: Commit**
```bash
git add package.json
git commit -m "chore: add lint/format/check scripts"
```

---

### Task 5: Editor integration

**Files:**
- Create: `.vscode/settings.json`

**Step 1: Create VS Code settings**
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.oxc": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "oxc.oxc-vscode"
  }
}
```

Install the `oxc.oxc-vscode` VS Code extension for inline diagnostics and format-on-save.

**Step 2: Commit**
```bash
mkdir -p .vscode
git add .vscode/settings.json
git commit -m "chore: vscode settings — oxlint diagnostics and format on save"
```

---

### Task 6: Final verification

**Step 1: Full check**

Run: `bun run check`
Expected: Zero lint errors, zero format violations

**Step 2: Tests still pass**

Run: `bun test`
Expected: All tests pass

**Step 3: Build still works**

Run: `bun build --compile --outfile=dist/barf src/index.ts`
Expected: Binary built without errors

**Step 4: Document in CLAUDE.md**

Add to the `## Commands` section:
```
bun run check                                        # lint + format check (oxlint + oxfmt)
bun run lint:fix                                     # auto-fix lint violations
```

**Step 5: Commit**
```bash
git add CLAUDE.md
git commit -m "docs: add lint/check commands to CLAUDE.md"
```

---

## Future

- Add `bun run check` to `barf-hook-precommit` so Claude cannot commit code with lint or format errors
- Consider stricter oxlint rule sets (e.g. `oxlint/recommended`) once codebase is stable
