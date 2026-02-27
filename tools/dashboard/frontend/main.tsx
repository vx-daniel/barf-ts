/**
 * Dashboard main entry — mounts the root Preact {@link App} component and
 * kicks off the initial data fetch + polling loop.
 *
 * All UI lives in components; this file is intentionally minimal.
 */

import { App } from '@dashboard/frontend/components/App'
import { fetchConfig, fetchIssues } from '@dashboard/frontend/lib/actions'
import {
  mountBottomResizer,
  mountSidebarResizer,
} from '@dashboard/frontend/lib/resizer'
import { pauseRefresh } from '@dashboard/frontend/lib/state'
import { render } from 'preact'

// ── Mount ────────────────────────────────────────────────────────────────────

const root = document.getElementById('app')
if (root) render(<App />, root)

// ── Resizers (imperative — drag handles on sidebar/bottom borders) ────────────

mountSidebarResizer()
mountBottomResizer()

// ── Polling ──────────────────────────────────────────────────────────────────

setInterval(() => {
  if (!pauseRefresh.value) void fetchIssues()
}, 5000)

// ── Start ────────────────────────────────────────────────────────────────────

void fetchConfig()
void fetchIssues()
