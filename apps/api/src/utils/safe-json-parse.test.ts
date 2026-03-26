import { describe, it, expect } from 'vitest';
import { safeJsonParse } from './safe-json-parse';

describe('safeJsonParse', () => {
  it('parses valid JSON and returns the result', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
    expect(safeJsonParse('"hello"', '')).toBe('hello');
    expect(safeJsonParse('42', 0)).toBe(42);
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('not json', 'fallback')).toBe('fallback');
    expect(safeJsonParse('{broken', [])).toEqual([]);
  });

  it('returns fallback for null', () => {
    expect(safeJsonParse(null, 'default')).toBe('default');
  });

  it('returns fallback for undefined', () => {
    expect(safeJsonParse(undefined, 99)).toBe(99);
  });

  it('returns fallback for empty string', () => {
    expect(safeJsonParse('', [1, 2])).toEqual([1, 2]);
  });

  it('preserves the generic type of the fallback', () => {
    const result: string[] = safeJsonParse('["a","b"]', []);
    expect(result).toEqual(['a', 'b']);
  });
});
