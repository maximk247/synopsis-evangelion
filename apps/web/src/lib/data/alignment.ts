import type { GospelKey } from '@synopsis/schema';

/** Stable key for a verse within a pericope, e.g. ("mt", 3, 13) -> "mt-3-13". */
export function verseKey(gospel: GospelKey, chapter: number, verse: number): string {
  return `${gospel}-${chapter}-${verse}`;
}
