/**
 * Claude iteration runner — SDK query setup, timeout, and signal management.
 *
 * This module creates and configures a Claude agent SDK query, sets up
 * the abort controller for timeouts, and delegates stream consumption
 * to `stream.ts`. It is the public-facing entry point for running a
 * single Claude iteration.
 *
 * Key SDK options:
 * - `permissionMode: 'bypassPermissions'` — replaces `--dangerously-skip-permissions`
 * - `settingSources: []` — SDK isolation; no CLAUDE.md loaded, all context from prompt
 * - `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '100'` — disables auto-compact so barf controls context
 *
 * @module claude/iteration
 */
import { query } from '@anthropic-ai/claude-agent-sdk'
import { mkdirSync } from 'fs'
import { ResultAsync } from 'neverthrow'
import { join } from 'path'
import type { Config, DisplayContext } from '@/types'
import type { IterationResult } from '@/types/schema/claude-schema'
import { toError } from '@/utils/toError'
import { getContextLimit, getThreshold } from './context'
import { consumeSDKQuery } from './stream'

/**
 * Runs a single Claude agent iteration via the `@anthropic-ai/claude-agent-sdk`.
 *
 * No subprocess is spawned — the SDK manages the Claude Code process internally.
 * This function handles:
 * 1. Computing the token threshold from config
 * 2. Setting up the abort controller with timeout
 * 3. Configuring stream logging (optional)
 * 4. Creating the SDK query with isolated settings
 * 5. Delegating stream consumption to {@link consumeSDKQuery}
 *
 * @param prompt - Full prompt text sent as the first user message.
 * @param model - Claude model identifier (e.g. `'claude-sonnet-4-6'`).
 * @param config - Loaded barf configuration (timeout, context percent, stream log dir).
 * @param issueId - When set, each SDK message is appended to `config.streamLogDir/<issueId>.jsonl`.
 * @param displayContext - When set, a sticky header line is shown above the progress line on TTY stderr.
 * @returns `ok(IterationResult)` on success/overflow/rate-limit, `err(Error)` if the SDK throws unexpectedly.
 * @category Claude Agent
 */
export function runClaudeIteration(
  prompt: string,
  model: string,
  config: Config,
  issueId?: string,
  displayContext?: DisplayContext,
): ResultAsync<IterationResult, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<IterationResult> => {
      const threshold = getThreshold(model, config.contextUsagePercent)
      const contextLimit = getContextLimit(model)

      const controller = new AbortController()
      const timeoutHandle =
        config.claudeTimeout > 0
          ? setTimeout(() => controller.abort(), config.claudeTimeout * 1000)
          : null

      let streamLogFile: string | undefined
      if (config.streamLogDir && issueId) {
        mkdirSync(config.streamLogDir, { recursive: true })
        streamLogFile = join(config.streamLogDir, `${issueId}.jsonl`)
      }

      const q = query({
        prompt,
        options: {
          model,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          settingSources: [],
          abortController: controller,
          cwd: process.cwd(),
          env: { ...process.env, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '100' },
        },
      })

      try {
        return await consumeSDKQuery(
          q,
          threshold,
          contextLimit,
          streamLogFile,
          process.stderr.isTTY ?? false,
          (data: string) => process.stderr.write(data),
          controller.signal,
          displayContext,
        )
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle)
        }
      }
    })(),
    toError,
  )
}
