# Plan: barf-ts Codebase Architecture Playground

## Context

barf-ts is a TypeScript/Bun CLI for orchestrating Claude AI agent work on issues. The codebase has ~33 source files across 5 layers (CLI entry, commands, core orchestrators, issue subsystem, utilities/types). The user wants a visual, interactive HTML playground to explore the architecture.

## What We'll Build

A single self-contained HTML file (`barf-architecture.html`) using the **code-map** playground template pattern — an SVG-based interactive architecture diagram with:

### Nodes (~25 components)
Real file paths and descriptions for every key module, organized in horizontal layer bands:

| Layer | Color | Modules |
|---|---|---|
| **CLI Entry** | blue-100 | `index.ts` |
| **CLI Commands** | amber-100 | `init`, `status`, `interview`, `plan`, `build`, `auto`, `audit` |
| **Core Orchestrators** | purple-100 | `batch.ts`, `claude.ts`, `interview.ts` |
| **Core Services** | green-100 | `config.ts`, `context.ts`, `prompts.ts`, `openai.ts` |
| **Issue Subsystem** | pink-100 | `issue/index.ts`, `base.ts`, `factory.ts`, `local.ts`, `github.ts` |
| **Types/Schemas** | gray-100 | `types/index.ts`, `schema/*` (grouped) |
| **Utilities** | slate-100 | `logger.ts`, `toError.ts`, `execFileNoThrow.ts`, `syncToResultAsync.ts` |

### Connections (~35 relationships)
Based on real import graph, with 4 connection types:

| Type | Color | Style | Meaning |
|---|---|---|---|
| `data-flow` | Blue | Solid | Function calls / data passing |
| `state-change` | Green | Dashed | Issue state transitions |
| `subprocess` | Orange | Long-dash | Spawning claude CLI process |
| `import` | Gray | Dotted | Module dependency |

### Presets (5)
1. **Full System** — all layers and connections
2. **Build Flow** — traces `barf build` from CLI → batch → claude → context → issue
3. **Interview Flow** — traces `barf interview` from CLI → interview → claude → Q&A loop
4. **Issue Management** — factory → base → local/github providers, state machine
5. **Audit Flow** — audit command → openai → exec checks

### Interactive Features
- Click-to-comment on any node (generates prompt output)
- Layer toggle checkboxes to show/hide groups
- Connection type filter checkboxes
- Zoom controls (+/−/reset)
- Live prompt output with copy button
- Issue state machine mini-diagram in the legend area
- Dark theme, no external dependencies

## Output File

`/home/daniel/Projects/barf/barf-ts/barf-architecture.html`

## Verification

1. Open file in browser: `open barf-architecture.html`
2. Verify all 5 presets show correct subsets
3. Verify layer toggles hide/show node groups
4. Verify click-to-comment → prompt updates
5. Verify copy button works
