import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from './synopsis.js';
import { buildReading } from './reading.js';

const raw = JSON.parse(
  readFileSync(new URL('../../../../../data/synopsis.json', import.meta.url), 'utf8')
);
const model = buildModel(raw);

describe('buildReading', () => {
  it('produces ordered blocks for Лука with pericope markers and verses', () => {
    const blocks = buildReading(model, 'lk');
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((b) => b.kind === 'pericope')).toBe(true);
    expect(blocks.some((b) => b.kind === 'verse')).toBe(true);
  });

  it('deduplicates repeated verses (each chapter-verse-suf appears once)', () => {
    const blocks = buildReading(model, 'lk');
    const seen = new Set<string>();
    let dup = 0;
    for (const b of blocks) {
      if (b.kind !== 'verse') continue;
      const key = `${b.chapter}-${b.verse}-${b.suf}`;
      if (seen.has(key)) dup++;
      seen.add(key);
    }
    expect(dup).toBe(0);
  });
});
