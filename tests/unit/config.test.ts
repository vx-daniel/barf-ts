import { describe, it, expect } from 'bun:test';
import { parseBarfrc } from '../../src/core/config';

describe('parseBarfrc', () => {
  it('returns defaults when content is empty', () => {
    const result = parseBarfrc('');
    expect(result.isOk()).toBe(true);
    const config = result._unsafeUnwrap();
    expect(config.issuesDir).toBe('issues');
    expect(config.issueProvider).toBe('local');
    expect(config.githubRepo).toBe('');
  });

  it('parses ISSUE_PROVIDER=github and GITHUB_REPO', () => {
    const result = parseBarfrc('ISSUE_PROVIDER=github\nGITHUB_REPO=owner/repo\n');
    const config = result._unsafeUnwrap();
    expect(config.issueProvider).toBe('github');
    expect(config.githubRepo).toBe('owner/repo');
  });

  it('ignores comments and blank lines', () => {
    const result = parseBarfrc('# comment\n\nISSUES_DIR=.barf/issues\n');
    expect(result._unsafeUnwrap().issuesDir).toBe('.barf/issues');
  });

  it('coerces numeric strings to numbers', () => {
    const result = parseBarfrc('CONTEXT_USAGE_PERCENT=80\nMAX_AUTO_SPLITS=5\n');
    const config = result._unsafeUnwrap();
    expect(config.contextUsagePercent).toBe(80);
    expect(config.maxAutoSplits).toBe(5);
  });

  it('returns Err on invalid ISSUE_PROVIDER value', () => {
    const result = parseBarfrc('ISSUE_PROVIDER=linear\n');
    expect(result.isErr()).toBe(true);
  });
});
