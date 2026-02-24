import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Config } from '@/types/index'
import type { PromptMode } from '@/types/schema/mode-schema'
import { createLogger } from '@/utils/logger'

export type { PromptMode } from '@/types/schema/mode-schema'

// Built-in prompt templates — embedded at compile time via Bun import attributes
import planPromptTemplate from '@/prompts/PROMPT_plan.md' with { type: 'text' }
import buildPromptTemplate from '@/prompts/PROMPT_build.md' with { type: 'text' }
import splitPromptTemplate from '@/prompts/PROMPT_split.md' with { type: 'text' }
import auditPromptTemplate from '@/prompts/PROMPT_audit.md' with { type: 'text' }
import triagePromptTemplate from '@/prompts/PROMPT_triage.md' with { type: 'text' }

const logger = createLogger('prompts')

const BUILTIN_TEMPLATES: Record<PromptMode, string> = {
  plan: planPromptTemplate,
  build: buildPromptTemplate,
  split: splitPromptTemplate,
  audit: auditPromptTemplate,
  triage: triagePromptTemplate
}

/**
 * Resolves a prompt template for the given mode.
 *
 * When `config.promptDir` is set, checks for `<promptDir>/PROMPT_<mode>.md`.
 * Falls back to the compiled-in template if the file is missing or `promptDir` is empty.
 * Reads synchronously — prompts are small and read once per iteration.
 * No caching, so custom prompts can be edited live during long runs.
 *
 * @param mode - Which prompt template to resolve.
 * @param config - Barf configuration containing `promptDir`.
 * @returns The prompt template string.
 * @category Prompts
 */
export function resolvePromptTemplate(mode: PromptMode, config: Config): string {
  if (config.promptDir) {
    const customPath = join(config.promptDir, `PROMPT_${mode}.md`)
    if (existsSync(customPath)) {
      logger.info({ mode, path: customPath }, 'using custom prompt template')
      return readFileSync(customPath, 'utf-8')
    }
    logger.info({ mode, path: customPath }, 'custom prompt not found — using built-in')
  }
  return BUILTIN_TEMPLATES[mode]
}
