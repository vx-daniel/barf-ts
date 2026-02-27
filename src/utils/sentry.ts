/**
 * Sentry integration — thin wrapper for operational observability.
 *
 * All exports are safe to call regardless of whether Sentry is initialised.
 * When no DSN is configured, {@link initSentry} is a no-op and the SDK
 * silently discards all events.
 *
 * @module Utilities
 */
import * as Sentry from '@sentry/node'
import type { Config } from '@/types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('sentry')

/** Whether Sentry has been successfully initialised this process. */
let initialised = false

/**
 * Initialises the Sentry SDK using values from the barf {@link Config}.
 *
 * Safe to call multiple times — subsequent calls are ignored.
 * When `config.sentryDsn` is falsy the call is a no-op.
 *
 * @param config - Loaded barf configuration containing optional Sentry fields.
 */
export function initSentry(config: Config): void {
  if (initialised || !config.sentryDsn) return

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment,
    tracesSampleRate: config.sentryTracesSampleRate,
    release: `barf@${process.env.npm_package_version ?? '2.0.0'}`,
  })

  initialised = true
  logger.debug('sentry initialised')
}

/**
 * Sets Sentry context for the current issue being processed.
 *
 * Attaches issue metadata as Sentry context so that all subsequent
 * events and breadcrumbs are tagged with the active issue.
 *
 * @param issueId - The issue identifier.
 * @param mode - Current loop mode (plan, build, split).
 * @param state - Current issue state.
 */
export function setIssueContext(
  issueId: string,
  mode: string,
  state: string,
): void {
  Sentry.setContext('issue', { id: issueId, mode, state })
  Sentry.setTag('issueId', issueId)
  Sentry.setTag('mode', mode)
}

/**
 * Adds a breadcrumb to the current Sentry scope.
 *
 * Breadcrumbs provide a trail of events leading up to an error,
 * useful for understanding what happened before a failure.
 */
export const addBreadcrumb: typeof Sentry.addBreadcrumb =
  Sentry.addBreadcrumb.bind(Sentry)

/**
 * Captures an exception and sends it to Sentry.
 *
 * Accepts the same overloads as the Sentry SDK's `captureException`.
 */
export const captureException: typeof Sentry.captureException =
  Sentry.captureException.bind(Sentry)

/**
 * Flushes pending Sentry events before process exit.
 *
 * @param timeoutMs - Maximum time to wait for flush, in milliseconds.
 * @returns Resolves to `true` if all events were sent.
 */
export function flushSentry(timeoutMs = 2000): Promise<boolean> {
  return Sentry.flush(timeoutMs)
}
