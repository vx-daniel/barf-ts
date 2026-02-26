# Plan 035: Always-On Per-Issue Stream Logging

## Context

The per-issue raw Claude SDK stream logging (raw JSONL of SDK messages) was opt-in via
`STREAM_LOG_DIR` in `.barfrc`. The requirement was unclear after a recent refactor. The
desired state is:

- **Per-issue stream log** — always-on, no config required, default path `.barf/streams/{issueId}.jsonl`
- **Disable** — possible by setting `STREAM_LOG_DIR=` (empty string) in `.barfrc`
- **Global barf pino log** — unchanged at `.barf/barf.jsonl`

## Approach

Replace the `STREAM_LOG_DIR` opt-in pattern with a `DISABLE_LOG_STREAM` opt-out flag:

- Remove `streamLogDir` config field and `STREAM_LOG_DIR` key
- Add `disableLogStream: boolean` config field (default `false`) mapped from `DISABLE_LOG_STREAM`
- Hardcode the stream log directory to `.barf/streams/{issueId}.jsonl`
- Update `iteration.ts` condition: `if (!config.disableLogStream && issueId)`

## Files to Modify

### 1. `src/types/schema/config-schema.ts`
```typescript
// Remove
streamLogDir: z.string().default(''),

// Add
/** Set to true to disable per-issue raw Claude stream logs. */
disableLogStream: z.coerce.boolean().default(false),
```

### 2. `src/core/config.ts`
```typescript
// Remove
STREAM_LOG_DIR: 'streamLogDir',

// Add
DISABLE_LOG_STREAM: 'disableLogStream',
```

### 3. `src/core/claude/iteration.ts`
```typescript
// Before
let streamLogFile: string | undefined
if (config.streamLogDir && issueId) {
  mkdirSync(config.streamLogDir, { recursive: true })
  streamLogFile = join(config.streamLogDir, `${issueId}.jsonl`)
}

// After
let streamLogFile: string | undefined
if (!config.disableLogStream && issueId) {
  const streamLogDir = '.barf/streams'
  mkdirSync(streamLogDir, { recursive: true })
  streamLogFile = join(streamLogDir, `${issueId}.jsonl`)
}
```

## Verification

1. Run `barf build` on a test issue — confirm `.barf/streams/{issueId}.jsonl` is created automatically
2. Set `DISABLE_LOG_STREAM=true` in `.barfrc` — confirm no stream file is created
3. Run `bun test` — confirm no unit test regressions
4. Check that `.barf/barf.jsonl` still receives pino structured logs as before
