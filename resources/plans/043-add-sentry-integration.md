# Plan: Add Sentry Integration

## Context

barf-ts has no error monitoring or operational observability. Errors are logged via pino to local JSONL files, but there's no aggregation, alerting, or cross-run visibility. The CLI entry point (`src/index.ts`) has no global unhandled rejection handler — crashes vanish silently. Adding Sentry provides operational observability: error patterns across batch runs, overflow/rate-limit trends, provider failure tracking, and dashboard crash reporting.

## Approach: Thin Wrapper (Approach A)

Single `src/utils/sentry.ts` module with no-op fallback when DSN is absent. Manual breadcrumbs at key operational boundaries. Config via `.barfrc` + env var override.

## Files to Create

### `src/utils/sentry.ts`
- `initSentry(config: Config): void` — init `@sentry/node` with DSN, environment, sample rate, release (from package.json version)
- Export helpers: `addBreadcrumb`, `captureException`, `setIssueContext(issueId, mode, state)`, `flushSentry()`
- When no DSN: all exports are no-ops (no import side effects)

## Files to Modify

### `src/types/index.ts` — ConfigSchema
Add optional fields:
- `sentryDsn: z.string().optional()`
- `sentryEnvironment: z.string().default('development')`
- `sentryTracesSampleRate: z.coerce.number().min(0).max(1).default(0.2)`

### `src/core/config.ts` — KEY_MAP
Add mappings:
- `SENTRY_DSN` → `sentryDsn`
- `SENTRY_ENVIRONMENT` → `sentryEnvironment`
- `SENTRY_TRACES_SAMPLE_RATE` → `sentryTracesSampleRate`

### `src/index.ts` — CLI entry
- After config load: `initSentry(config)`
- Wrap `program.parseAsync()` with `.catch()` → `captureException` + `flushSentry` + `process.exit(1)`

### `src/core/batch/loop.ts` — Batch loop
- At loop start: `setIssueContext(issueId, mode, issue.state)`
- Per iteration: `addBreadcrumb({ category: 'iteration', data: { iteration, outcome, tokensUsed } })`
- On error outcome: `captureException()` with issue tags

### `src/core/batch/stream.ts` — Stream consumer
- On `ContextOverflowError`: breadcrumb with token count
- On `RateLimitError`: breadcrumb with reset time

### `src/core/issue/providers/local.ts` — Lock failures
- Breadcrumb on lock contention (already logged, add Sentry breadcrumb)

### `tools/dashboard/server.ts` — Dashboard
- Init Sentry at server start (reuse same `initSentry` or import directly)
- Add global error handler for unhandled request errors

## Dependencies

- `bun add @sentry/node` (Sentry Node.js SDK — supports Bun runtime)

## Config Example (.barfrc)

```
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.2
```

## Testing

- Unit test `src/utils/sentry.ts`: mock `@sentry/node`, verify init with correct params, verify no-op when DSN absent
- Manual: set DSN, run `barf build`, verify events appear in Sentry dashboard
- Manual: run dashboard server, trigger an error, verify it appears in Sentry

## Verification

1. `bun test` — all existing tests pass (no regressions)
2. `bun run build` (if applicable) — no type errors
3. Set `SENTRY_DSN` in `.barfrc`, run `barf status` — verify no console errors from Sentry init
4. Intentionally trigger an error — verify it appears in Sentry
