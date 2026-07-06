import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READING_FONT_KEY,
  READING_FONT_OPTIONS,
  isReadingFontKey,
  readingFontValue
} from './fonts.js';

describe('reading fonts', () => {
  it('has 15 options and calibri default', () => {
    expect(READING_FONT_OPTIONS).toHaveLength(15);
    expect(DEFAULT_READING_FONT_KEY).toBe('calibri');
    expect(READING_FONT_OPTIONS.some((f) => f.key === 'calibri')).toBe(true);
  });

  it('validates keys', () => {
    expect(isReadingFontKey('georgia')).toBe(true);
    expect(isReadingFontKey('nope')).toBe(false);
    expect(isReadingFontKey(null)).toBe(false);
  });

  it('returns the css stack for a key and falls back to default', () => {
    expect(readingFontValue('georgia')).toContain('Georgia');
    expect(readingFontValue('calibri')).toContain('Calibri');
  });
});
