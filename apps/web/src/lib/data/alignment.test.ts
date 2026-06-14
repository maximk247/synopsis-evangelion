import { describe, expect, it } from 'vitest';
import { buildAlignmentMap, verseKey } from './alignment.js';
import type { Pericope } from '@synopsis/schema';

const pericope = {
  alignment: [{ mt: '3:13', mk: '1:9' }, { mt: '3:14' }, { mt: '3:16', mk: '1:10', lk: '3:21' }]
} as unknown as Pericope;

describe('buildAlignmentMap', () => {
  it('maps each verse key to its row index', () => {
    const map = buildAlignmentMap(pericope);
    expect(map.get('mt-3-13')).toBe(0);
    expect(map.get('mk-1-9')).toBe(0);
    expect(map.get('mt-3-14')).toBe(1);
    expect(map.get('lk-3-21')).toBe(2);
    expect(map.get('mk-1-10')).toBe(2);
  });

  it('returns an empty map when alignment is null', () => {
    const map = buildAlignmentMap({ alignment: null } as unknown as Pericope);
    expect(map.size).toBe(0);
  });

  it('verseKey ignores suffix letters (aligns by chapter:verse)', () => {
    expect(verseKey('mt', 3, 13)).toBe('mt-3-13');
  });
});
