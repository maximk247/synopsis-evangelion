import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from './synopsis.js';

// pnpm test runs prepare-data first, so exercise the same data the reader receives.
const prepared = JSON.parse(
  readFileSync(new URL('../../../static/data/synopsis.json', import.meta.url), 'utf8')
);
const model = buildModel(prepared);

describe('prepared pericopes with mixed PDF columns', () => {
  it.each([
    ['165', 'mt', 28, 1, 10],
    ['165', 'mk', 16, 1, 11],
    ['165', 'lk', 24, 1, 12],
    ['165', 'jn', 20, 1, 18],
    ['143.3', 'mt', 26, 21, 25],
    ['143.3', 'mk', 14, 18, 21],
    ['143.3', 'lk', 22, 21, 23],
    ['143.3', 'jn', 13, 21, 30]
  ] as const)(
    'preserves the complete canonical %s / %s passage without stray notes',
    (id, g, chapter, first, last) => {
      const canonical = JSON.parse(
        readFileSync(new URL(`../../../../../data/canonical/${g}.json`, import.meta.url), 'utf8')
      );
      const segments = model.byId.get(id)!.columns[g]!.segments;
      expect(segments.length).toBeGreaterThan(0);
      for (const segment of segments) {
        expect(segment.gospel).toBe(g);
        expect(segment.chapter).toBe(chapter);
      }
      expect(segments.flatMap((s) => s.items)).toEqual(
        Array.from({ length: last - first + 1 }, (_, i) => ({
          v: i + first,
          suf: '',
          t: canonical[chapter][i + first]
        }))
      );
    }
  );

  it('preserves navigation and notes outside the affected passage', () => {
    const source = JSON.parse(
      readFileSync(new URL('../../../../../data/synopsis.json', import.meta.url), 'utf8')
    );
    const original = buildModel(source);
    for (const [id, g] of [
      ['165', 'mk'],
      ['165', 'lk'],
      ['143.3', 'lk']
    ] as const) {
      const segment = model.byId.get(id)!.columns[g]!.segments[0];
      const before = original.byId.get(id)!.columns[g]!.segments[0];
      expect(segment.prev).toEqual(before.prev);
      expect(segment.next).toEqual(before.next);
    }
    for (const p of model.raw.pericopes) {
      if (p.id === '165') continue;
      for (const g of ['mk', 'lk'] as const) {
        const notes = p.columns[g]?.segments.flatMap((s) => s.items.filter((i) => 'note' in i));
        const before = original.byId.get(p.id)!.columns[g]?.segments;
        // Canonical preparation may recover verses from notes, but must not add stray notes.
        const originalNotes = new Set(
          before?.flatMap((s) => s.items.filter((i) => 'note' in i).map((i) => i.note))
        );
        for (const note of notes ?? []) expect(originalNotes.has(note.note)).toBe(true);
      }
    }
  });
});
