# 036 — Architecture Documentation

## Context

The barf-ts codebase lacks a concise reference for its architecture. This makes it harder to reason about changes, understand data flows, and onboard to new areas. The goal is to create focused, scannable documentation files in `resources/architecture/` that capture key concepts, flows, and component relationships — useful as persistent context for future work.

## Approach

Create `resources/architecture/` with small, focused Markdown files (one concept per file). Use ASCII diagrams for flows. No prose padding — optimize for quick reference.

## Files to Create

| File | Covers |
|------|--------|
| `overview.md` | Tech stack, key patterns (neverthrow, Zod, Bun), directory map |
| `issue-state-machine.md` | IssueState enum, VALID_TRANSITIONS matrix, frontmatter fields |
| `batch-loop.md` | runLoop phases, iteration cycle, outcome dispatch |
| `claude-integration.md` | SDK usage, stream consumption, context overflow, token tracking |
| `triage.md` | Triage one-shot flow, needs_interview flag, interview questions |
| `providers.md` | IssueProvider abstraction, local (POSIX locking) vs GitHub (label locking) |
| `config.md` | .barfrc format, key settings, environment fallbacks |
| `dashboard.md` | Backend routes, SSE streaming, frontend panels, data flow |

## Critical Files Referenced

- `src/index.ts` — CLI entry / command dispatch
- `src/core/issue/index.ts` — state machine, VALID_TRANSITIONS
- `src/core/issue/base.ts` — IssueProvider abstract class
- `src/core/batch/loop.ts` — runLoop orchestration
- `src/core/batch/outcomes.ts` — outcome handlers
- `src/core/claude/iteration.ts` — runClaudeIteration
- `src/core/claude/stream.ts` — consumeSDKQuery
- `src/core/triage/triage.ts` — triageIssue
- `src/core/config.ts` — config parser
- `tools/dashboard/routes/api.ts` — REST API
- `tools/dashboard/routes/sse.ts` — SSE streaming
- `src/types/schema/` — all Zod schemas

## Verification

After creating files:
1. Read each file to ensure it's concise and accurate
2. Verify diagrams reflect actual code paths
3. Check no placeholder content remains

## Notes

- No new code — documentation only
- Files should be 50–120 lines each (scannable, not exhaustive)
- ASCII flow diagrams preferred over prose descriptions
- This is knowledge base for future AI-assisted development
