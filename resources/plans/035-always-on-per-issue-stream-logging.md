# Plan 035: Always-On Per-Issue Stream Logging

## Context

The per-issue raw Claude SDK stream logging (raw JSONL of SDK messages) was opt-in via
`STREAM_LOG_DIR` in `.barfrc`. The requirement was unclear after a recent refactor. The
desired state is:

- **Per-issue stream log** — always-on, no config required, default path `.barf/streams/{issueId}.jsonl`
- **Disable** — possible by setting `DISABLE_LOG_STREAM=true` in `.barfrc`
- **Global barf pino log** — unchanged at `.barf/barf.jsonl`

## Approach

Replace the `STREAM_LOG_DIR` opt-in pattern with a `DISABLE_LOG_STREAM` opt-out flag:

- Remove `streamLogDir` config field and `STREAM_LOG_DIR` key
- Add `disableLogStream: boolean` config field (default `false`) mapped from `DISABLE_LOG_STREAM`
- Hardcode the stream log directory to `.barf/streams/{issueId}.jsonl`
- Update `iteration.ts` condition: `if (!config.disableLogStream && issueId)`

## Files Modified

### `src/types/schema/config-schema.ts`
- Removed `streamLogDir: z.string().default('')`
- Added `disableLogStream: z.coerce.boolean().default(false)`

### `src/core/config.ts`
- Replaced `STREAM_LOG_DIR: 'streamLogDir'` with `DISABLE_LOG_STREAM: 'disableLogStream'`
- Replaced `streamLogDir` coercion in `RawConfigSchema` with boolean preprocess

### `src/core/claude/iteration.ts`
- Flipped opt-in to opt-out: `if (!config.disableLogStream && issueId)`
- Hardcoded path to `.barf/streams/{issueId}.jsonl`

### `tools/dashboard/routes/sse.ts`
- `handleLogTail` and `handleLogHistory` now check `disableLogStream` and use the hardcoded path

### `tools/dashboard/routes/api.ts`
- Updated key mapping from `streamLogDir`/`STREAM_LOG_DIR` to `disableLogStream`/`DISABLE_LOG_STREAM`

### `tools/dashboard/frontend/panels/config.ts`
- Replaced stream dir text field with `disableLogStream` boolean toggle

### `tests/unit/prompts.test.ts`
- Updated inline config fixture: `streamLogDir: ''` → `disableLogStream: false`

### `tests/sample-project/.barfrc.local` / `.barfrc.github`
- Replaced `STREAM_LOG_DIR=...` with a commented-out `# DISABLE_LOG_STREAM=true` example

## Verification

1. Run `barf build` on a test issue — confirm `.barf/streams/{issueId}.jsonl` is created automatically
2. Set `DISABLE_LOG_STREAM=true` in `.barfrc` — confirm no stream file is created
3. Run `bun test` — confirm no unit test regressions (497 pass, 0 fail)
4. Check that `.barf/barf.jsonl` still receives pino structured logs as before
