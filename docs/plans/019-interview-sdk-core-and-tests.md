# Plan 019: Extract SDK core module and add interviewLoop tests

## Problem

1. `interviewLoop` embeds raw SDK plumbing inline, mirroring the old pre-`claude.ts` pattern
2. No unit tests for `interviewLoop` — the actual SDK interaction has 0 coverage
3. `SDKResultError.errors[]` array is silently dropped in thrown errors
4. `SDKAssistantMessage.error` (auth/billing failures) is never checked

## Solution

Extract SDK `query()` interaction into `src/core/claude-sdk.ts` (analogous to `claude.ts`),
then mock it cleanly in tests.

## Files

| File | Action |
|---|---|
| `src/core/claude-sdk.ts` | **Create** — SDK turn runner |
| `src/core/interview.ts` | **Edit** — use `runSdkTurn`, remove direct SDK import |
| `tests/unit/interview.test.ts` | **Edit** — add `interviewLoop` describe block |
| `docs/plans/019-interview-sdk-core-and-tests.md` | **Create** — this file |
