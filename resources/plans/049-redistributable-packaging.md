# 049 — Redistributable Packaging

## Context

barf is currently installed via `git clone` + `bun build --compile` + manual copy to PATH. The team needs a proper release pipeline to distribute pre-built binaries across macOS, Linux, and Windows via GitHub Releases (private repo, internal team).

## Approach: GitHub Releases + Cross-Platform CI

### 1. Package.json Updates
**File**: `package.json`

- Add `"bin": { "barf": "./dist/barf" }` for local dev
- Add scripts:
  - `"build:release": "bun build --compile --outfile=dist/barf src/index.ts"`
  - Keep existing `"build"` as-is
- Ensure `"version": "2.0.0"` is the single source of truth

### 2. GitHub Actions Release Workflow
**File**: `.github/workflows/release.yml`

- **Trigger**: Push tag `v*`
- **Matrix**:

| Target | Binary | Runner |
|--------|--------|--------|
| `bun-darwin-arm64` | `barf-darwin-arm64` | `macos-latest` |
| `bun-darwin-x64` | `barf-darwin-x64` | `macos-13` |
| `bun-linux-x64` | `barf-linux-x64` | `ubuntu-latest` |
| `bun-linux-arm64` | `barf-linux-arm64` | `ubuntu-24.04-arm` |
| `bun-windows-x64` | `barf-windows-x64.exe` | `windows-latest` |

- **Steps per matrix entry**:
  1. Checkout
  2. Install Bun
  3. `bun install`
  4. `bun build --compile --target=$TARGET --outfile=dist/$BINARY src/index.ts`
  5. Upload artifact

- **Final job** (`release`, needs all builds):
  1. Download all artifacts
  2. Create GitHub Release from tag via `gh release create`
  3. Attach all binaries

### 3. Install Script
**File**: `install.sh` (repo root)

- Detect OS (`uname -s`) and arch (`uname -m`)
- Map to binary name
- Download from latest GitHub Release via `gh release download` or `curl` with token
- Install to `~/.local/bin/barf` (or user-specified path)
- Print success + prerequisite reminders (`claude`, `gh`)

**File**: `install.ps1` — PowerShell equivalent for Windows

### 4. Version Check Command
**File**: `src/cli/commands/version-check.ts` (new)
**Modify**: `src/index.ts` (add command)

- `barf update-check` command (or hook into existing `--version`)
- Uses `gh api repos/{owner}/{repo}/releases/latest` to fetch latest tag
- Compare semver against current version from `package.json`
- Print notice if outdated: "New version available: v2.1.0 (current: v2.0.0)"
- Keep it simple — no auto-download, just inform

### 5. README Updates
**File**: `README.md`

- Replace manual build instructions with:
  - **Install from release**: download binary or use `install.sh`
  - **Build from source**: existing clone + build flow
- Prerequisites section: `claude` CLI (required), `gh` CLI (optional for GitHub provider + version check)

## Files to Create/Modify

| Action | File |
|--------|------|
| Modify | `package.json` |
| Create | `.github/workflows/release.yml` |
| Create | `install.sh` |
| Create | `install.ps1` |
| Create | `src/cli/commands/version-check.ts` |
| Modify | `src/index.ts` |
| Modify | `README.md` |

## Verification

1. **Local build**: `bun run build:release` produces working binary
2. **Cross-compile test**: `bun build --compile --target=bun-linux-x64 --outfile=dist/barf-linux-x64 src/index.ts` succeeds
3. **Version check**: `./dist/barf update-check` prints current version and checks GitHub
4. **Install script**: `bash install.sh` on macOS/Linux installs correctly
5. **CI dry-run**: Push a test tag to verify workflow (can delete release after)
6. **Existing tests**: `bun test` still passes (no regressions)
