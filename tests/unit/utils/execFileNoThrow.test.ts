import { describe, it, expect } from 'bun:test';
import { execFileNoThrow } from '../../../src/utils/execFileNoThrow';

describe('execFileNoThrow', () => {
  it('returns stdout on success', async () => {
    const result = await execFileNoThrow('echo', ['hello']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.stderr).toBe('');
  });

  it('returns non-zero status without throwing', async () => {
    const result = await execFileNoThrow('false', []);
    expect(result.status).not.toBe(0);
  });

  it('captures stderr', async () => {
    const result = await execFileNoThrow('sh', ['-c', 'echo err >&2; exit 1']);
    expect(result.stderr.trim()).toBe('err');
    expect(result.status).not.toBe(0);
  });
});
