# 065 — Sidebar Prompt Editor

## Context

Users can customize barf prompt templates via `PROMPT_DIR`, but the only way to edit them is manually on disk. The dashboard sidebar already has CodeMirror editors for issue bodies and plans — extending this to prompt templates gives users a visual editor with preview, diff against built-in defaults, and inline `$VAR` highlighting. This also requires refactoring the monolithic Sidebar into composable panels.

## Design

### Sidebar Refactor

Split `Sidebar.tsx` into 3 components:

- **`Sidebar.tsx`** — thin shell: mode toggle (`issue` | `prompts`), close button, renders `IssuePanel` or `PromptsPanel`
- **`IssuePanel.tsx`** — extracted from current Sidebar (all issue + plan tab logic, unchanged behavior)
- **`PromptsPanel.tsx`** — new prompt editor component

A `sidebarMode` signal in `state.ts` controls which panel is shown. Header has toggle buttons. Sidebar shows even without a selected issue when in `prompts` mode.

### PromptsPanel Component

- **Dropdown**: select one of 7 prompt templates (plan, build, split, audit, triage, interview, interview_eval)
- **Badge**: "customized" indicator when a custom override exists
- **Sub-tabs**: Preview | Edit | Diff
  - Preview: rendered markdown via `marked` + `safeRenderHTML`
  - Edit: CodeMirror 6 with `$VAR` inline highlighting (yellow bg + tooltip via `Decoration.mark`)
  - Diff: side-by-side `<pre>` blocks (builtin vs custom)
- **Actions**: Save (writes to PROMPT_DIR), Revert to Default (deletes custom override)

### Backend API

4 new endpoints in `tools/dashboard/routes/api.ts`:

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/prompts` | Return list of 7 prompt mode names |
| GET | `/api/prompts/:mode` | Return `{ mode, builtin, custom, active }` |
| PUT | `/api/prompts/:mode` | Save `{ content }` to `PROMPT_DIR/PROMPT_{mode}.md` |
| DELETE | `/api/prompts/:mode` | Delete custom override file |

Auto-create `PROMPT_DIR` (default: `.barf/prompts/`) if not configured. Update `.barfrc` `PROMPT_DIR` setting if auto-created.

### Prerequisite

Add `interview` to `BUILTIN_TEMPLATES` in `src/core/prompts.ts` and to `PromptModeSchema` — currently only 6 of 7 are compiled-in.

## Files to Modify

| File | Change |
|------|--------|
| `src/core/prompts.ts` | Add `interview` import + `BUILTIN_TEMPLATES` entry |
| `src/types/schema/` | Add `interview` to `PromptModeSchema` if missing |
| `tools/dashboard/routes/api.ts` | Add 4 prompt handlers |
| `tools/dashboard/server.ts` | Wire 4 prompt routes |
| `tools/dashboard/frontend/lib/api-client.ts` | Add `PromptData` type + 4 API functions |
| `tools/dashboard/frontend/lib/state.ts` | Add `sidebarMode` signal |
| `tools/dashboard/frontend/components/Sidebar.tsx` | Refactor to thin shell |
| `tools/dashboard/frontend/components/IssuePanel.tsx` | **New** — extracted from Sidebar |
| `tools/dashboard/frontend/components/PromptsPanel.tsx` | **New** — prompt editor |
| `tools/dashboard/frontend/styles/index.css` | Add `.cm-prompt-var` highlight style |

## Implementation Sequence

1. **Prerequisite**: Add `interview` to `PromptModeSchema` + `BUILTIN_TEMPLATES`
2. **Backend**: 4 API handlers in `api.ts` + routes in `server.ts`
3. **API client**: 4 functions in `api-client.ts`
4. **Extract IssuePanel**: Pure refactor — move all content from `Sidebar.tsx` into `IssuePanel.tsx`, no behavior change
5. **Refactor Sidebar**: Add `sidebarMode` signal, make Sidebar a shell that toggles panels
6. **Build PromptsPanel**: Start with dropdown + preview tab
7. **Add edit tab**: CodeMirror + `$VAR` highlighting ViewPlugin
8. **Add diff tab**: Side-by-side builtin vs custom
9. **Wire save/revert**: Connect to PUT/DELETE API endpoints

## $VAR Highlighting

CodeMirror `ViewPlugin` with `Decoration.mark({ class: 'cm-prompt-var' })` matching `/\$[A-Z_]+/g` in visible ranges. CSS: yellow semi-transparent background.

## Reuse

- `resolvePromptTemplate()` from `src/core/prompts.ts` — backend prompt resolution
- `BUILTIN_TEMPLATES` from `src/core/prompts.ts` — built-in template content
- CodeMirror setup pattern from current `Sidebar.tsx` (extensions, theme, docChanged tracking)
- `safeRenderHTML()` + `marked` for markdown preview
- DaisyUI `tabs`, `select`, `btn`, `badge` components
- `api-client.ts` fetch/save pattern

## Verification

1. `bun run dashboard:build` — frontend compiles without errors
2. Start dashboard: `bun run tools/dashboard/server.ts`
3. Open sidebar → toggle to Prompts mode → verify dropdown lists all 7 templates
4. Select a template → verify preview renders markdown correctly
5. Switch to Edit tab → verify CodeMirror loads with content, `$VAR` tokens highlighted
6. Edit content → Save → verify file written to `.barf/prompts/PROMPT_{mode}.md`
7. Switch to Diff tab → verify side-by-side shows builtin vs custom
8. Click Revert → verify custom file deleted, content reverts to builtin
9. Toggle back to Issues mode → verify existing issue/plan editing still works
10. Run existing tests: `bun test`
