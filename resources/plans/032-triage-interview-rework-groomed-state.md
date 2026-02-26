# 032 — Triage/Interview Rework with GROOMED State

## Context

The current dashboard shows an "interview" button on all NEW issues, but the interview flow doesn't work properly — it tries to spawn a nonexistent CLI command. The triage/interview distinction is unclear: triage (AI evaluation) and interview (user Q&A) are conflated under one button.

**Goal**: Separate triage and interview into distinct actions, add a GROOMED state for refined issues, and build a working interview UI in the dashboard with Claude evaluation.

## New Flow

```
NEW (needs_interview=undefined)  →  click "triage"  →  Claude evaluates issue
  ├─ needs_interview=false  →  auto-transition to GROOMED
  └─ needs_interview=true   →  stays NEW, button changes to "interview"
                                 click "interview"  →  modal Q&A
                                 →  Claude evaluates answers
                                 →  satisfied? → GROOMED
                                 →  not satisfied? → more questions in modal
GROOMED  →  click "plan"  →  PLANNED  →  ...normal flow
```

## Changes

### 1. State Machine — Add GROOMED state

**Files**: `src/types/schema/issue-schema.ts`, `src/core/issue/index.ts`

- Add `'GROOMED'` to `IssueState` enum/union
- Update `VALID_TRANSITIONS`:
  ```
  NEW       → ['GROOMED', 'STUCK']        (remove PLANNED)
  GROOMED   → ['PLANNED', 'STUCK', 'SPLIT']  (new)
  STUCK     → ['PLANNED', 'NEW', 'GROOMED', 'SPLIT']  (add GROOMED)
  ```
- Triage-related: `PLAN_STATES` in auto.ts includes `GROOMED` instead of `NEW`

### 2. Triage — Auto-transition to GROOMED when clean

**Files**: `src/core/triage/triage.ts`, `src/cli/commands/auto.ts`

- When `needs_interview=false`: also transition state `NEW → GROOMED`
- When `needs_interview=true`: keep in `NEW` (no longer transition to STUCK)
- Update `auto.ts` plan phase: filter `GROOMED` issues (not `NEW`) for planning
- Update triage phase: still triage `NEW` where `needs_interview === undefined`

### 3. Dashboard Button Logic

**Files**: `tools/dashboard/frontend/panels/kanban.ts`, `tools/dashboard/frontend/panels/editor.ts`

For NEW issues, determine button dynamically:
- `needs_interview === undefined` → show `['triage']`
- `needs_interview === true` → show `['interview']`
- `needs_interview === false` → show nothing (should auto-transition)

GROOMED shows `['plan']`.

### 4. Triage Button — Backend

**Files**: `tools/dashboard/routes/sse.ts`, `tools/dashboard/server.ts`

- Add `'triage'` to allowed SSE commands
- Spawns: `bun run src/index.ts --cwd <projectCwd> triage --issue <id>`

### 5. Triage CLI Command

**Files**: `src/index.ts`, `src/cli/commands/triage.ts` (new)

- `barf triage --issue <id>` — runs `triageIssue()` for one issue

### 6. Interview Modal — Frontend

**Files**: `tools/dashboard/frontend/panels/interview-modal.ts` (new), `tools/dashboard/frontend/index.html`

Modal UI with Q&A flow, progress indicator, radio buttons for options, "Other" text input.

### 7. Interview Backend — API Endpoint

**Files**: `tools/dashboard/routes/api.ts`, `tools/dashboard/server.ts`

`POST /api/issues/:id/interview` — sends answers to Claude for evaluation, transitions to GROOMED if satisfied.

### 8. Interview Evaluation Prompt

**Files**: `src/prompts/PROMPT_interview_eval.md` (new)

### 9. Tests

Updated state machine, triage, auto, audit, and provider tests for GROOMED state.

### 10. Kanban Board Column

Added GROOMED column between NEW and PLANNED with blue styling.

## Implementation Status

**COMPLETE** — All changes implemented and 438/438 tests passing.

## File Summary

| File | Action |
|------|--------|
| `src/types/schema/issue-schema.ts` | Add GROOMED to IssueState |
| `src/types/schema/mode-schema.ts` | Add interview_eval to PromptMode |
| `src/core/issue/index.ts` | Update VALID_TRANSITIONS |
| `src/core/triage/triage.ts` | Auto-transition to GROOMED, stay NEW on interview |
| `src/core/batch/loop.ts` | Build mode only transitions from PLANNED |
| `src/core/prompts.ts` | Add interview_eval template |
| `src/cli/commands/auto.ts` | Plan from GROOMED, update filters |
| `src/cli/commands/triage.ts` | **New** — standalone triage CLI command |
| `src/cli/commands/index.ts` | Export triage command |
| `src/index.ts` | Register triage command |
| `src/prompts/PROMPT_interview_eval.md` | **New** — Claude eval prompt |
| `tools/dashboard/server.ts` | Add interview route, triage allowed |
| `tools/dashboard/routes/api.ts` | Add handleInterview endpoint |
| `tools/dashboard/routes/sse.ts` | Add triage to allowed commands |
| `tools/dashboard/frontend/panels/kanban.ts` | Dynamic buttons, GROOMED column |
| `tools/dashboard/frontend/panels/editor.ts` | Dynamic buttons, GROOMED state |
| `tools/dashboard/frontend/panels/interview-modal.ts` | **New** — modal component |
| `tools/dashboard/frontend/main.ts` | Wire interview modal |
| `tools/dashboard/frontend/index.html` | Modal mount point |
| `tools/dashboard/frontend/lib/api-client.ts` | Add submitInterview |
| `tools/dashboard/frontend/styles/base.css` | Triage + interview modal styles |
| `tests/unit/issue.test.ts` | GROOMED state tests |
| `tests/unit/triage.test.ts` | Updated triage behavior tests |
| `tests/unit/auto.test.ts` | Plans GROOMED, not NEW |
| `tests/unit/audit.test.ts` | Updated VALID_TRANSITIONS assertion |
| `tests/unit/issue-providers/local.test.ts` | Updated transition test |
