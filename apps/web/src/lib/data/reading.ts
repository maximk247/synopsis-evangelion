import { isVerse, type GospelKey } from '@synopsis/schema';
import type { SynopsisModel } from './synopsis.js';

export type ReadingBlock =
  | { kind: 'pericope'; id: string; title: string }
  | { kind: 'chapter'; chapter: number }
  | { kind: 'verse'; chapter: number; verse: number; suf: string; text: string };

interface Row {
  chapter: number;
  verse: number;
  suf: string;
  text: string;
  pid: string;
  title: string;
  order: number;
}

/**
 * Flatten a single gospel into a continuous reading stream in canonical order
 * (chapter:verse), regardless of where the synopsis places each pericope.
 * Inserts a pericope marker when the source pericope changes and a chapter
 * marker when the chapter changes. Repeated verses (same chapter:verse:suf)
 * are shown once — the earliest pericope wins.
 */
export function buildReading(model: SynopsisModel, gospel: GospelKey): ReadingBlock[] {
  const rows: Row[] = [];
  let order = 0;
  for (const p of model.raw.pericopes) {
    const col = p.columns[gospel];
    if (!col) continue;
    for (const seg of col.segments) {
      for (const item of seg.items) {
        if (!isVerse(item)) continue;
        rows.push({
          chapter: seg.chapter,
          verse: item.v,
          suf: item.suf,
          text: item.t,
          pid: p.id,
          title: p.title,
          order: order++
        });
      }
    }
  }

  rows.sort(
    (a, b) =>
      a.chapter - b.chapter ||
      a.verse - b.verse ||
      a.suf.localeCompare(b.suf, 'ru') ||
      a.order - b.order
  );

  const blocks: ReadingBlock[] = [];
  const seen = new Set<string>();
  let lastPid: string | null = null;
  let lastChapter: number | null = null;

  for (const r of rows) {
    const key = `${r.chapter}-${r.verse}-${r.suf}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (r.pid !== lastPid) {
      blocks.push({ kind: 'pericope', id: r.pid, title: r.title });
      lastPid = r.pid;
      lastChapter = null; // force a chapter marker after a pericope marker
    }
    if (r.chapter !== lastChapter) {
      blocks.push({ kind: 'chapter', chapter: r.chapter });
      lastChapter = r.chapter;
    }
    blocks.push({ kind: 'verse', chapter: r.chapter, verse: r.verse, suf: r.suf, text: r.text });
  }
  return blocks;
}
