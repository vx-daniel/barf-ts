import OpenAI from 'openai'
import { ResultAsync } from 'neverthrow'
import type { OpenAIChatResult, OpenAIChatOptions } from '@/types/schema/openai-schema'
import { createLogger } from '@/utils/logger'
import { toError } from '@/utils/toError'

export type { OpenAIChatResult, OpenAIChatOptions } from '@/types/schema/openai-schema'

const logger = createLogger('openai')

/**
 * Sends a single-turn chat completion to the OpenAI API and returns the response.
 *
 * Constructs a fresh client per call to avoid stale state. Uses the `openai` SDK
 * which handles 429 retries automatically (2 retries, exponential backoff).
 *
 * @param prompt - The user message to send.
 * @param model - OpenAI model identifier (e.g. `'gpt-4o'`).
 * @param apiKey - OpenAI API key.
 * @param options - Optional temperature, max tokens, and response format.
 * @returns `ok(OpenAIChatResult)` with content and token counts, `err(Error)` on API failure.
 *
 * @category OpenAI
 */
export function runOpenAIChat(
  prompt: string,
  model: string,
  apiKey: string,
  options?: OpenAIChatOptions
): ResultAsync<OpenAIChatResult, Error> {
  return ResultAsync.fromPromise(
    (async (): Promise<OpenAIChatResult> => {
      const client = new OpenAI({ apiKey })

      logger.debug({ model, promptLen: prompt.length }, 'sending chat completion')

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens,
        response_format: options?.responseFormat
      })

      const choice = response.choices[0]
      const content = choice?.message?.content ?? ''
      const usage = response.usage

      logger.debug(
        {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens
        },
        'chat completion done'
      )

      return {
        content,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0
      }
    })(),
    toError
  )
}
