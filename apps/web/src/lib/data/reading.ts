import { isVerse, type GospelKey } from '@synopsis/schema';
import type { SynopsisModel } from './synopsis.js';

export type ReadingBlock =
  | { kind: 'pericope'; id: string; title: string }
  | { kind: 'chapter'; chapter: number }
  | { kind: 'verse'; chapter: number; verse: number; suf: string; text: string };

/**
 * Flatten a single gospel into a continuous reading stream in pericope order.
 * Inserts a pericope marker when entering a new pericope and a chapter marker
 * when the chapter changes. Repeated verses (same chapter:verse:suf) are shown once.
 */
export function buildReading(model: SynopsisModel, gospel: GospelKey): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  const seen = new Set<string>();
  let lastChapter: number | null = null;

  for (const p of model.raw.pericopes) {
    const col = p.columns[gospel];
    if (!col) continue;
    let emittedMarker = false;

    for (const seg of col.segments) {
      for (const item of seg.items) {
        if (!isVerse(item)) continue;
        const key = `${seg.chapter}-${item.v}-${item.suf}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (!emittedMarker) {
          blocks.push({ kind: 'pericope', id: p.id, title: p.title });
          emittedMarker = true;
          lastChapter = null; // force a chapter marker after a pericope marker
        }
        if (seg.chapter !== lastChapter) {
          blocks.push({ kind: 'chapter', chapter: seg.chapter });
          lastChapter = seg.chapter;
        }
        blocks.push({
          kind: 'verse',
          chapter: seg.chapter,
          verse: item.v,
          suf: item.suf,
          text: item.t
        });
      }
    }
  }
  return blocks;
}
