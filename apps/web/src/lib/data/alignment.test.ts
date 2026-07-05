import { describe, expect, it } from 'vitest';
import { verseKey } from './alignment.js';

describe('verseKey', () => {
  it('builds a stable gospel-chapter-verse key (suffix letters excluded)', () => {
    expect(verseKey('mt', 3, 13)).toBe('mt-3-13');
    expect(verseKey('lk', 1, 5)).toBe('lk-1-5');
  });
});
