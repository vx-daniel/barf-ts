# Plan: Add preact-perf-profiler to dashboard components

## Context

After fixing the activity log memory leak, we want render profiling instrumentation so performance regressions are visible in Chrome DevTools Performance tab. `preact-perf-profiler` is already installed.

## Implementation — 1 new file

### `tools/dashboard/frontend/lib/perf.ts`

Centralize all `track()` calls in one file. Import every exported component and register it. This avoids scattering `track()` calls across component files and makes it easy to disable.

```ts
import { track } from 'preact-perf-profiler'
import { ActivityLog } from '@dashboard/frontend/components/ActivityLog'
import { App } from '@dashboard/frontend/components/App'
import { EditorSidebar } from '@dashboard/frontend/components/EditorSidebar'
import { KanbanBoard } from '@dashboard/frontend/components/KanbanBoard'
import { SessionList } from '@dashboard/frontend/components/SessionList'
import { StatusBar } from '@dashboard/frontend/components/StatusBar'
import { Header } from '@dashboard/frontend/components/Header'
import { InterviewModal } from '@dashboard/frontend/components/InterviewModal'

track(ActivityLog)
track(App)
track(EditorSidebar)
track(KanbanBoard)
track(SessionList)
track(StatusBar)
track(Header)
track(InterviewModal)
```

### `tools/dashboard/frontend/main.tsx`

Add a single import at the top (side-effect only):

```ts
import '@dashboard/frontend/lib/perf'
```

Gate behind an env check so it's dev-only and doesn't ship to production:

```ts
if (globalThis.__PERF_PROFILER__) {
  import('@dashboard/frontend/lib/perf')
}
```

Actually — since this is an internal dev dashboard (not a public app), always-on is fine. Just a bare side-effect import.

## Verification

1. `bun run dashboard:build`
2. Open dashboard in Chrome, open DevTools → Performance tab
3. Record a session while interacting with the dashboard
4. Component render timings should appear as User Timing marks in the flame chart
