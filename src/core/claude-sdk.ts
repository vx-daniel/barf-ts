import { mkdirSync, createWriteStream, type WriteStream } from 'fs'
import { join } from 'path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { ResultAsync } from 'neverthrow'
import type { ClaudeEvent } from '@/types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('claude-sdk')

/** Structured output shape returned by one SDK query turn. */
export interface SdkTurnResult {
  /** Session ID captured from the `system/init` message; `undefined` if not received. */
  sessionId: string | undefined
  /** Raw `structured_output` field from the SDK `result/success` message. */
  structuredOutput: unknown
  /** Output token count from the result usage block. */
  tokens: number
}

/** Options for {@link runSdkTurn}. */
export interface SdkTurnOptions {
  /** Claude model identifier (e.g. `'claude-sonnet-4-6'`). */
  model: string
  /** System prompt sent to the SDK. */
  systemPrompt: string
  /** Built-in tool names to allow (e.g. `['Read']`). */
  tools: string[]
  /** JSON schema passed to `outputFormat: json_schema`. */
  outputSchema: Record<string, unknown>
  /** Existing session ID to resume; omit to start a new session. */
  sessionId?: string
  /** Controller used to abort the running query. */
  abortController: AbortController
  /** Called for each {@link ClaudeEvent} emitted during this turn. */
  onEvent?: (event: ClaudeEvent) => void
  /** Called for each line of stderr from the SDK subprocess. */
  onStderr?: (data: string) => void
  /** Issue ID for structured log context only. */
  issueId?: string
  /** Turn number for structured log context only. */
  turn?: number
  /** When set with `issueId`, appends each SDK message as JSONL to `{streamLogDir}/{issueId}.jsonl`. */
  streamLogDir?: string
}

/**
 * Runs one SDK query turn and returns the structured output.
 *
 * Handles `system/init` (captures session ID), `assistant` (fires `onEvent` for
 * tool-use blocks and logs `msg.error` if present), and `result` messages.
 * On `result/success` returns {@link SdkTurnResult}; on any error subtype throws
 * an `Error` that includes the `errors[]` array from the SDK result.
 *
 * Sets `CLAUDECODE=undefined` so barf can run inside an existing Claude Code session
 * without the SDK refusing to start.
 *
 * @param prompt - Text sent to the SDK for this turn.
 * @param options - Model, schema, session resume, abort, and event hooks.
 * @returns `ok(SdkTurnResult)` on success, `err(Error)` on SDK error or exception.
 */
export function runSdkTurn(
  prompt: string,
  options: SdkTurnOptions
): ResultAsync<SdkTurnResult, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<SdkTurnResult> => {
      let sessionId = options.sessionId

      const sdkQuery = query({
        prompt,
        options: {
          model: options.model,
          cwd: process.cwd(),
          maxTurns: 3,
          outputFormat: { type: 'json_schema', schema: options.outputSchema },
          systemPrompt: options.systemPrompt,
          tools: options.tools,
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
          abortController: options.abortController,
          resume: options.sessionId,
          env: { ...process.env, CLAUDECODE: undefined },
          stderr: options.onStderr ? (data: string) => options.onStderr!(data) : undefined
        }
      })

      let streamLog: WriteStream | null = null
      if (options.streamLogDir && options.issueId) {
        mkdirSync(options.streamLogDir, { recursive: true })
        streamLog = createWriteStream(join(options.streamLogDir, `${options.issueId}.jsonl`), {
          flags: 'a'
        })
      }

      try {
        for await (const msg of sdkQuery) {
          streamLog?.write(JSON.stringify(msg) + '\n')
          logger.info(
            {
              issueId: options.issueId,
              turn: options.turn,
              type: msg.type,
              subtype: (msg as { subtype?: string }).subtype ?? null
            },
            'sdk msg'
          )

          if (msg.type === 'system' && msg.subtype === 'init') {
            sessionId = msg.session_id
          } else if (msg.type === 'assistant') {
            if (msg.error) {
              logger.warn(
                { issueId: options.issueId, turn: options.turn, error: msg.error },
                'assistant message error'
              )
            }
            for (const block of msg.message.content) {
              if (block.type === 'tool_use') {
                options.onEvent?.({
                  type: 'tool',
                  name: (block as { type: 'tool_use'; name: string }).name
                })
              }
            }
          } else if (msg.type === 'result') {
            if (msg.subtype === 'success') {
              options.onEvent?.({ type: 'usage', tokens: msg.usage.output_tokens })
              logger.info(
                {
                  issueId: options.issueId,
                  turn: options.turn,
                  structured_output: msg.structured_output
                },
                'sdk result'
              )
              return {
                sessionId,
                structuredOutput: msg.structured_output,
                tokens: msg.usage.output_tokens
              }
            } else {
              const detail = msg.errors.length > 0 ? `: ${msg.errors.join('; ')}` : ''
              throw new Error(`SDK error: ${msg.subtype}${detail}`)
            }
          }
        }

        // Stream ended without a result message — return with no structured output
        return { sessionId, structuredOutput: undefined, tokens: 0 }
      } finally {
        streamLog?.end()
      }
    })(),
    e => (e instanceof Error ? e : new Error(String(e)))
  )
}
