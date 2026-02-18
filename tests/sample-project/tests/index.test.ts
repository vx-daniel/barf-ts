import { describe, it, expect } from 'bun:test';
import { reverse, truncate } from '../src/index';

describe('reverse', () => {
  it('reverses a string', () => expect(reverse('hello')).toBe('olleh'));
  it('handles empty string', () => expect(reverse('')).toBe(''));
  it('handles single char', () => expect(reverse('a')).toBe('a'));
});

describe('truncate', () => {
  it('truncates long strings', () => expect(truncate('hello world', 5)).toBe('hello…'));
  it('leaves short strings unchanged', () => expect(truncate('hi', 10)).toBe('hi'));
  it('leaves exact-length strings unchanged', () => expect(truncate('hello', 5)).toBe('hello'));
});
