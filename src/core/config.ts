import { z } from 'zod';
import { Result, ok, err } from 'neverthrow';
import { ConfigSchema, type Config } from '../types/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Zod schema that coerces string values (all .barfrc values are strings)
const RawConfigSchema = ConfigSchema.extend({
  contextUsagePercent:  z.coerce.number().int().default(75),
  maxAutoSplits:        z.coerce.number().int().default(3),
  maxIterations:        z.coerce.number().int().default(0),
  claudeTimeout:        z.coerce.number().int().default(3600),
});

/** Parse a .barfrc KEY=VALUE string into a validated Config. */
export function parseBarfrc(content: string): Result<Config, z.ZodError> {
  const raw: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const KEY_MAP: Record<string, keyof Config> = {
      ISSUES_DIR:             'issuesDir',
      PLAN_DIR:               'planDir',
      CONTEXT_USAGE_PERCENT:  'contextUsagePercent',
      MAX_AUTO_SPLITS:        'maxAutoSplits',
      MAX_ITERATIONS:         'maxIterations',
      CLAUDE_TIMEOUT:         'claudeTimeout',
      TEST_COMMAND:           'testCommand',
      PLAN_MODEL:             'planModel',
      BUILD_MODEL:            'buildModel',
      SPLIT_MODEL:            'splitModel',
      EXTENDED_CONTEXT_MODEL: 'extendedContextModel',
      PUSH_STRATEGY:          'pushStrategy',
      ISSUE_PROVIDER:         'issueProvider',
      GITHUB_REPO:            'githubRepo',
    };
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    const mapped = KEY_MAP[key];
    if (mapped) raw[mapped] = val;
  }
  const parsed = RawConfigSchema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err(parsed.error);
}

export function loadConfig(projectDir: string = process.cwd()): Config {
  const rcPath = join(projectDir, '.barfrc');
  try {
    const content = readFileSync(rcPath, 'utf8');
    return parseBarfrc(content).match(
      (config) => config,
      () => RawConfigSchema.parse({}),
    );
  } catch {
    return RawConfigSchema.parse({});
  }
}
