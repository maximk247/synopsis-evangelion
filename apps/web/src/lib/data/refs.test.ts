import { describe, expect, it } from 'vitest';
import { parseRef } from './refs.js';

describe('parseRef', () => {
  it('parses "Мф 5:3"', () => {
    expect(parseRef('Мф 5:3')).toEqual({ gospel: 'mt', chapter: 5, verse: 3 });
  });
  it('parses "Ин.1:29" with a dot separator', () => {
    expect(parseRef('Ин.1:29')).toEqual({ gospel: 'jn', chapter: 1, verse: 29 });
  });
  it('parses full names and abbreviations', () => {
    expect(parseRef('Матфей 3:13')).toEqual({ gospel: 'mt', chapter: 3, verse: 13 });
    expect(parseRef('Мк 1:9')).toEqual({ gospel: 'mk', chapter: 1, verse: 9 });
    expect(parseRef('Лк 6:20')).toEqual({ gospel: 'lk', chapter: 6, verse: 20 });
  });
  it('parses chapter-only references (verse defaults to undefined)', () => {
    expect(parseRef('Мф 5')).toEqual({ gospel: 'mt', chapter: 5, verse: undefined });
  });
  it('returns null for non-references', () => {
    expect(parseRef('Агнец Божий')).toBeNull();
    expect(parseRef('')).toBeNull();
  });
});
