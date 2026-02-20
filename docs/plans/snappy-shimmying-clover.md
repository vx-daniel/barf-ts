# Fix: Update CONTEXT_USAGE_PERCENT in .barfrc.local

## Context

User set `CONTEXT_USAGE_PERCENT=26` in the wrong file. The `--config tests/sample-project/.barfrc.local` flag points to that file, which still has `CONTEXT_USAGE_PERCENT=75` — so the threshold stayed at 150,000 tokens (75% × 200k) and no overflow was triggered at 45,660 tokens (30% of threshold).

## Change

**File:** `tests/sample-project/.barfrc.local`

Change:
```
CONTEXT_USAGE_PERCENT=75
```
To:
```
CONTEXT_USAGE_PERCENT=26
```

This sets threshold = floor(26/100 × 200,000) = 52,000 tokens. The next run will trigger overflow (→ split) once tokens exceed 52k.
