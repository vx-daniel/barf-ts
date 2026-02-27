# 056 — Active Session Group in Activity Log Sidebar

## Context

When `barf auto` is running, it spawns child sessions (triage, plan, build) that complete quickly and drop into the "Recent" list. This makes it hard to see what's happening in the current run — active and completed children from the current run are mixed with older sessions.

## Goal

Add an **"Active"** section above "Recent" in the SessionList sidebar that groups the currently running auto session and all its children together, regardless of whether children have completed.

## Implementation

### File: `tools/dashboard/frontend/components/SessionList.tsx`

1. **Update the filter logic** (lines 153-159) to create an `active` group:
   - Find running sessions (`status === 'running'`), collect their IDs
   - `active` = running sessions + any session whose `parentSessionId` matches a running session
   - `recent` = everything not in `active` and not archived
   - `archived` = everything not in `active` and archived

2. **Replace the "Running" render block** (lines 171-183) with an "Active" header rendering the `active` array instead.

### ~15 lines changed in one file.

#### New filter logic:
```ts
const running = allSessions.filter((s) => s.status === 'running')
const runningIds = new Set(running.map((s) => s.sessionId))

const active = allSessions.filter(
  (s) => runningIds.has(s.sessionId) ||
    (s.parentSessionId !== undefined && runningIds.has(s.parentSessionId))
)
const activeIds = new Set(active.map((s) => s.sessionId))

const recent = allSessions.filter((s) => !activeIds.has(s.sessionId) && !s.archived)
const archivedSessions = allSessions.filter((s) => !activeIds.has(s.sessionId) && s.archived)
```

#### Render "Active" section (replaces "Running"):
- Header text: "Active" in `text-success/70`
- Shows all `active` sessions (parent + children)

## Key type info

- `Session.parentSessionId?: string` — already on the type (`session-index-schema.ts:219`)
- `Session.status: 'running' | 'completed' | 'crashed'`
- Backend already populates `parentSessionId` for auto children (`session-service.ts:97`)

## Verification

1. `bun run dashboard:build` — compiles
2. Start dashboard, run `barf auto` on sample-project
3. Confirm: running auto session + its child sessions grouped under "Active"
4. Confirm: completed sessions from previous runs appear under "Recent"
5. Confirm: when auto finishes, all sessions move to "Recent"
