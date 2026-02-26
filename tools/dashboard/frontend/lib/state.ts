/**
 * Reactive application state — single source of truth for all panels.
 *
 * Signals from `@preact/signals` auto-subscribe Preact components that read
 * `.value` during render, and re-render only the components that depend on a
 * changed signal. Import from here; mutate only via the action functions in
 * {@link module:lib/actions}.
 */

import type { Issue } from '@dashboard/frontend/lib/types'
import { signal } from '@preact/signals'

/** Full issue list, refreshed every 5 s and after each command. */
export const issues = signal<Issue[]>([])

/** ID of the issue currently open in the editor sidebar, or `null`. */
export const selectedId = signal<string | null>(null)

/**
 * ID of the issue whose barf command is currently running, `'__auto__'` when
 * the auto-loop is active, or `null` when idle.
 */
export const runningId = signal<string | null>(null)

/** When `true` the polling loop is suppressed during active SSE streaming. */
export const pauseRefresh = signal(false)

/** Config/model map loaded from `.barfrc`; `null` until first fetch. */
export const models = signal<Record<string, string> | null>(null)

/**
 * Label of the currently running command shown in the status bar
 * (e.g. `"build #42"` or `"auto"`), or `null` when idle.
 */
export const activeCommand = signal<string | null>(null)
