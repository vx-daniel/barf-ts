import { z } from 'zod'

/**
 * Token usage and content returned by a single OpenAI chat completion.
 *
 * @category OpenAI
 */
export const OpenAIChatResultSchema = z.object({
  content: z.string(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number()
})
/** A validated OpenAI chat result. Derived from {@link OpenAIChatResultSchema}. */
export type OpenAIChatResult = z.infer<typeof OpenAIChatResultSchema>

/**
 * Optional parameters for `runOpenAIChat`.
 *
 * @category OpenAI
 */
export const OpenAIChatOptionsSchema = z.object({
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  responseFormat: z.object({ type: z.enum(['json_object', 'text']) }).optional()
})
/** Validated OpenAI chat options. Derived from {@link OpenAIChatOptionsSchema}. */
export type OpenAIChatOptions = z.infer<typeof OpenAIChatOptionsSchema>
