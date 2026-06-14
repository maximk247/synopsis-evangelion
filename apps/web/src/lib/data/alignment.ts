import type { GospelKey, Pericope } from '@synopsis/schema';

const GOSPEL_KEYS = ['mt', 'mk', 'lk', 'jn'] as const;

/** Stable key for a verse within a pericope, e.g. ("mt", 3, 13) -> "mt-3-13". */
export function verseKey(gospel: GospelKey, chapter: number, verse: number): string {
  return `${gospel}-${chapter}-${verse}`;
}

/** Parse an alignment value "3:13" into [chapter, verse]; null if malformed. */
function parseChapterVerse(value: string): [number, number] | null {
  const m = /^(\d+):(\d+)/.exec(value.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

/**
 * Map verse key -> alignment row index. Verses sharing a row are parallels.
 * Returns an empty map when the pericope has no alignment.
 */
export function buildAlignmentMap(pericope: Pericope): Map<string, number> {
  const map = new Map<string, number>();
  const rows = pericope.alignment;
  if (!rows) return map;
  rows.forEach((row, index) => {
    for (const g of GOSPEL_KEYS) {
      const value = row[g];
      if (!value) continue;
      const cv = parseChapterVerse(value);
      if (!cv) continue;
      map.set(verseKey(g, cv[0], cv[1]), index);
    }
  });
  return map;
}
