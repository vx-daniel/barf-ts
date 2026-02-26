/**
 * Claude stream event schemas — structured events emitted during SDK iteration.
 *
 * These events are emitted by `consumeSDKQuery` in `core/claude/stream.ts` as
 * it processes the Claude agent SDK message stream. They provide real-time
 * observability into token usage and tool invocations during a Claude session.
 *
 * @module events-schema
 */
import { z } from 'zod'

/**
 * A structured event emitted during SDK iteration.
 *
 * Uses a discriminated union on the `type` field:
 * - `'usage'` — cumulative token count from the main conversation context
 * - `'tool'` — a tool invocation name extracted from an assistant message
 *
 * These events power the TTY progress display and context monitoring that
 * triggers overflow decisions (split or escalate to a larger model).
 *
 * @category Claude Stream
 * @group Claude Events
 */
export const ClaudeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('usage'), tokens: z.number() }),
  z.object({ type: z.literal('tool'), name: z.string() }),
])

/**
 * A parsed Claude stream event. Derived from {@link ClaudeEventSchema}.
 *
 * @category Claude Stream
 * @group Claude Events
 */
export type ClaudeEvent = z.infer<typeof ClaudeEventSchema>
