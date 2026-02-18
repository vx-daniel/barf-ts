# sample-project

A small string utility library used for testing barf.

## Commands

```bash
bun test          # run all tests
bun test --watch  # watch mode
```

## Conventions

- All utility functions exported from `src/index.ts`
- Each function has a corresponding test in `tests/<name>.test.ts`
- Pure functions only — no side effects, no I/O
- TypeScript strict mode
