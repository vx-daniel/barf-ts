# 18: Replace Claude with ChatGPT for Audit

## Status: IMPLEMENTED

Replaced Claude subprocess (`runClaudeIteration`) with OpenAI API (`runOpenAIChat`) for the audit command. Audit now uses structured JSON responses parsed with Zod instead of filesystem-side-effect detection.

## Changes

### Created
- `src/core/audit-schema.ts` — Zod discriminated union for audit response (pass/fail with findings)
- `src/core/openai.ts` — Reusable OpenAI chat wrapper with ResultAsync pattern
- `tests/unit/audit-schema.test.ts` — Schema validation tests
- `tests/unit/openai.test.ts` — OpenAI wrapper tests (mock SDK)

### Modified
- `src/types/index.ts` — Added `openaiApiKey`, changed `auditModel` default to `gpt-4o`
- `src/core/config.ts` — Added `AUDIT_MODEL`, `INTERVIEW_MODEL`, `OPENAI_API_KEY` to KEY_MAP
- `src/prompts/PROMPT_audit.md` — JSON response format instead of filesystem output
- `src/cli/commands/audit.ts` — Full rewrite: OpenAI API + structured JSON + provider.createIssue()
- `tests/unit/audit-full.test.ts` — Updated mocks from Claude to OpenAI SDK layer
- `tests/unit/interview.test.ts` — Updated auditModel default assertion

### Dependencies
- Added `openai@6.22.0`
