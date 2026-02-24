# Plan 025: Codex CLI Audit Provider

## Context

The audit system currently supports three providers (OpenAI API, Gemini API, Claude API), all requiring paid API keys. The user has a ChatGPT subscription plan that includes access to the `@openai/codex` CLI tool — which authenticates via that subscription rather than per-token API billing. This plan adds a `codex` audit provider that wraps the `codex -q <prompt>` CLI invocation, letting users run audits against their subscription without incurring separate API costs.

## Approach

Add a `CodexAuditProvider` class following the exact pattern of existing providers (`src/providers/claude.ts` etc.), using `execFileNoThrow` to shell out to the `codex` binary. Token counts will be zero (the CLI doesn't expose them). No new config keys are needed — codex authenticates via its own stored session.

## Files Modified

| File | Change |
|---|---|
| `src/providers/codex.ts` | Created — `CodexAuditProvider` class |
| `src/providers/index.ts` | Added import, export, factory case for `'codex'` |
| `src/types/index.ts` | Added `'codex'` to `auditProvider` enum |
| `tests/unit/providers/codex.test.ts` | Created — unit tests (6 cases) |
| `tests/unit/providers/factory.test.ts` | Added codex factory case |

## .barfrc Usage

```
AUDIT_PROVIDER=codex
```

No API key needed. The `codex` binary must be installed and authenticated.
