import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Synopsis, parseSynopsis } from '../src/synopsis.js';

const dataUrl = new URL('../../../data/synopsis.json', import.meta.url);
const raw: unknown = JSON.parse(readFileSync(dataUrl, 'utf8'));

describe('Synopsis schema vs real data', () => {
  it('validates the real data/synopsis.json', () => {
    const result = Synopsis.safeParse(raw);
    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues.slice(0, 5), null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('exposes the expected top-level counts', () => {
    const data = parseSynopsis(raw);
    expect(data.pericopes.length).toBe(253);
    expect(data.sections.length).toBe(17);
    expect(data.appendix2.rows.every((r) => r.length === data.appendix2.columns.length)).toBe(true);
  });

  it('accepts a pericope with alignment === null', () => {
    const data = parseSynopsis(raw);
    expect(data.pericopes.some((p) => p.alignment === null)).toBe(true);
  });

  it('rejects malformed data (footnotes.n must be a string)', () => {
    const bad = JSON.parse(JSON.stringify(raw)) as { footnotes: { n: unknown; text: string }[] };
    const [first] = bad.footnotes;
    if (!first) throw new Error('fixture is missing footnotes');
    first.n = 1; // number, not string
    expect(Synopsis.safeParse(bad).success).toBe(false);
  });
});
