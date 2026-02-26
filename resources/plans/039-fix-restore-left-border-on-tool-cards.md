# Fix: Restore Left-Border on Tool Cards

## Context

After unifying all rows to use `.activity-row` + `.activity-summary`, tool cards lost their
colored left border. The fix is two lines:

1. **CSS** — restore `border-left: 3px solid` on `.tool-card/.agent-card/.skill-card/.error-row`
2. **TS** — add `activity-row` to tool card `className` so it inherits base padding

Both changes are already applied in the working tree.

## Files Modified

- `tools/dashboard/frontend/styles/activity.css`
- `tools/dashboard/frontend/panels/activity-log.ts`
