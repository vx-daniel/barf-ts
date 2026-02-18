import { z } from 'zod';

// ── Issue ─────────────────────────────────────────────────────────────────────

export const IssueStateSchema = z.enum([
  'NEW', 'PLANNED', 'IN_PROGRESS', 'STUCK', 'SPLIT', 'COMPLETED',
]);
export type IssueState = z.infer<typeof IssueStateSchema>;

export const IssueSchema = z.object({
  id:          z.string(),
  title:       z.string(),
  state:       IssueStateSchema,
  parent:      z.string(),
  children:    z.array(z.string()),
  split_count: z.number().int().nonnegative(),
  body:        z.string(),
});
export type Issue = z.infer<typeof IssueSchema>;

// ── Config ────────────────────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  issuesDir:             z.string().default('issues'),
  planDir:               z.string().default('plans'),
  contextUsagePercent:   z.number().int().default(75),
  maxAutoSplits:         z.number().int().default(3),
  maxIterations:         z.number().int().default(0),
  claudeTimeout:         z.number().int().default(3600),
  testCommand:           z.string().default(''),
  planModel:             z.string().default('claude-opus-4-6'),
  buildModel:            z.string().default('claude-sonnet-4-6'),
  splitModel:            z.string().default('claude-sonnet-4-6'),
  extendedContextModel:  z.string().default('claude-opus-4-6'),
  pushStrategy:          z.enum(['iteration', 'on_complete', 'manual']).default('iteration'),
  issueProvider:         z.enum(['local', 'github']).default('local'),
  githubRepo:            z.string().default(''),
});
export type Config = z.infer<typeof ConfigSchema>;

// ── Claude stream events ──────────────────────────────────────────────────────

export const ClaudeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('usage'), tokens: z.number() }),
  z.object({ type: z.literal('tool'), name: z.string() }),
]);
export type ClaudeEvent = z.infer<typeof ClaudeEventSchema>;

// ── Error types ───────────────────────────────────────────────────────────────

export class InvalidTransitionError extends Error {
  constructor(from: IssueState, to: IssueState) {
    super(`Invalid transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class ProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ProviderError';
  }
}
