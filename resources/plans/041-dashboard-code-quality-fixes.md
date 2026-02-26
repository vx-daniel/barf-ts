# 041-dashboard-code-quality-fixes

## Context

A code quality review of `tools/dashboard/frontend/` revealed 15 issues across Critical, High, and Medium severity. The biggest risks are an XSS vector in Markdown preview rendering, a race-condition bug passing `undefined` as an issue ID, and a leaked `EventSource` on Stop. Secondary issues include triplicated state constants that have already silently diverged (causing a live bug where GROOMED issues show no color in the status bar), `console.error` calls that violate project logging rules, and the `el()` DOM helper being copy-pasted into 5 files.

## Critical Fixes

### 1. XSS in Markdown Preview
**File:** `tools/dashboard/frontend/panels/editor.ts:63`

`safeRenderHTML()` uses `DOMParser` + `appendChild` which executes inline event handlers (e.g., `<img onerror=...>`). Markdown rendered by `marked` is passed directly to this function.

**Fix:** Strip all event-handler attributes (`on*`) and `<script>` elements from the parsed doc before appending. Add a `sanitizeDoc(doc: Document): void` helper that walks all elements and removes dangerous attributes:
```typescript
function sanitizeDoc(doc: Document): void {
  for (const el of doc.body.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    }
  }
  for (const script of doc.body.querySelectorAll('script')) script.remove()
}
```
Call this inside `safeRenderHTML` before the `appendChild` loop.

### 2. Undefined issue ID on race condition
**File:** `tools/dashboard/frontend/panels/interview-modal.ts:179`

`api.submitInterview(currentIssue?.id, answers)` passes `undefined` if modal is closed during submit.

**Fix:** Guard at top of submit handler:
```typescript
if (!currentIssue) return
const result = await api.submitInterview(currentIssue.id, answers)
```

## High Fixes

### 3. EventSource leak on Stop
**File:** `tools/dashboard/frontend/main.ts:312`

`logSSE` (per-command SSE for log streaming) is a local variable that `stopActive()` cannot reach.

**Fix:** Promote `logSSE` to module level alongside `sseClient` and `wsClient`. Call `logSSE.close()` inside `stopActive()`.

### 4. Discarded interval handle
**File:** `tools/dashboard/frontend/main.ts:124`

`setInterval` return value is discarded.

**Fix:** Store in module-level `let refreshInterval: ReturnType<typeof setInterval> | null = null` and assign it. Not critical for this single-page app but prevents duplicate pollers if init is ever called twice.

### 5. Triplicated state constants (live bug)
**Files:** `kanban.ts:17-56`, `editor.ts:19-55`, `status.ts:21-29`

`STATE_COLORS` is in 3 files; `status.ts` already missing `GROOMED` entry (live bug: GROOMED issues show no status bar color). `CMD_ACTIONS`/`CMD_CLASS` duplicated in kanban + editor.

**Fix:** Create `tools/dashboard/frontend/lib/constants.ts`:
- Move `STATE_COLORS`, `STATE_LABELS`, `STATE_ORDER`, `CMD_ACTIONS`, `CMD_CLASS` here
- Import in all panels, remove local copies
- Add `GROOMED` to the canonical `STATE_COLORS`

### 6. `console.error` violations
**Files:** `main.ts:112`, `config.ts:282`

Violates project rule "Never use `console.*`".

**Fix:** Replace with `termLog('error', ...)` calls (already used elsewhere in main.ts for errors).

### 7. Token cast bug
**File:** `tools/dashboard/frontend/panels/activity-log.ts:557`

`(entry.data.input_tokens as number) ?? 0` — cast happens before nullish check; string values would cause string concatenation.

**Fix:** `Number(entry.data.input_tokens ?? 0)` — `Number()` coerces strings to numbers correctly.

### 8. `pendingToolCards` detached DOM references
**File:** `tools/dashboard/frontend/panels/activity-log.ts:525`

After interrupted runs, map holds detached DOM nodes. Already cleaned by `clearLog()` but only at next run start.

**Fix:** In `clearLog()`, explicitly call `pendingToolCards.clear()` (verify it's already there — if so, this is already handled correctly). No change needed if `clearLog` already clears it.

## Medium Fixes

### 9. `api.stopActive()` fire-and-forget
**File:** `tools/dashboard/frontend/main.ts:178`

**Fix:** Attach `.catch(e => termLog('error', String(e)))`.

### 10. `alert()` for create-issue errors
**File:** `tools/dashboard/frontend/main.ts:452`

**Fix:** Replace `alert(...)` with `termLog('error', ...)`.

### 11. `el()` helper duplicated in 5 files
**Files:** All panel files

**Fix:** Move to `tools/dashboard/frontend/lib/dom.ts`, export, import in each panel. Remove local copies.

### 12. Duplicate comment
**File:** `tools/dashboard/frontend/panels/editor.ts:301-302`

**Fix:** Remove the duplicate line.

## Out of Scope

- **Full DOM diffing** for `renderBoard` (issue #7) — proper diffing would require a virtual DOM or keyed reconciler; deferring to a future plan
- **`VALID_TRANSITIONS` frontend drift** (issue #10) — this requires the API to expose the state machine, architectural change for future plan

## Critical Files to Modify

| File | Changes |
|------|---------|
| `tools/dashboard/frontend/panels/editor.ts` | `sanitizeDoc()` in `safeRenderHTML`, import constants, remove duplicate comment |
| `tools/dashboard/frontend/panels/interview-modal.ts` | Guard before `submitInterview` |
| `tools/dashboard/frontend/main.ts` | Promote `logSSE`, store interval, fix `console.error`, fix `alert`, fix fire-and-forget |
| `tools/dashboard/frontend/panels/kanban.ts` | Import from constants, remove local copies |
| `tools/dashboard/frontend/panels/status.ts` | Import from constants, remove local copies (fix GROOMED bug) |
| `tools/dashboard/frontend/panels/activity-log.ts` | Fix token cast |
| `tools/dashboard/frontend/panels/config.ts` | Fix `console.error` |
| `tools/dashboard/frontend/lib/constants.ts` | **New file** — all shared state/command constants |
| `tools/dashboard/frontend/lib/dom.ts` | **New file** — `el()` helper |

## Verification

1. Run the dashboard: `bun run tools/dashboard/server.ts`
2. Verify GROOMED issues show a color in the status bar (regression for issue #5)
3. Open an issue with `![x](x)<img src=x onerror="alert(1)">` in body — verify no alert fires in Preview tab
4. Start a command, click Stop before it completes — verify no lingering network connections in DevTools → Network (for issue #3)
5. Confirm no `console.error` calls appear in browser console during normal usage
