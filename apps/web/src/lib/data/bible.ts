import { base } from '$app/paths';
import { BibleBook, type GospelKey } from '@synopsis/schema';

export interface ChapterVerse {
  verse: number;
  text: string;
}

/** Отрезок главы: подряд идущие стихи, одинаковые по подсветке. */
export interface ChapterRun {
  hl: boolean;
  items: ChapterVerse[];
}

/**
 * Режет главу на отрезки по подсветке, чтобы подряд идущие подсвеченные стихи
 * рисовались одной сплошной полосой, а не блоком на каждый стих.
 */
export function splitRuns(
  verses: ChapterVerse[],
  highlighted: ReadonlySet<number>
): ChapterRun[] {
  const runs: ChapterRun[] = [];
  for (const v of verses) {
    const hl = highlighted.has(v.verse);
    const last = runs[runs.length - 1];
    if (last && last.hl === hl) last.items.push(v);
    else runs.push({ hl, items: [v] });
  }
  return runs;
}

/** Номера глав книги по возрастанию. */
export function chapterNumbers(book: BibleBook): number[] {
  return Object.keys(book)
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
}

/** Стихи главы по возрастанию номера; пустой массив, если такой главы нет. */
export function getChapter(book: BibleBook, chapter: number): ChapterVerse[] {
  const verses = book[String(chapter)];
  if (!verses) return [];
  return Object.entries(verses)
    .map(([v, text]) => ({ verse: Number(v), text }))
    .sort((a, b) => a.verse - b.verse);
}

/** Соседние главы книги; null там, где край. */
export function neighbourChapters(
  book: BibleBook,
  chapter: number
): { prev: number | null; next: number | null } {
  const nums = chapterNumbers(book);
  const i = nums.indexOf(chapter);
  if (i === -1) return { prev: null, next: null };
  return { prev: nums[i - 1] ?? null, next: nums[i + 1] ?? null };
}

const cache = new Map<GospelKey, Promise<BibleBook>>();

/**
 * Канонический текст евангелия из /data/bible/{g}.json (кладёт prepare-data.mjs).
 * Грузится один раз на евангелие; неудачную попытку не кешируем.
 */
export function loadBook(gospel: GospelKey, fetchFn: typeof fetch = fetch): Promise<BibleBook> {
  const hit = cache.get(gospel);
  if (hit) return hit;

  const pending = fetchFn(`${base}/data/bible/${gospel}.json`).then(async (res) => {
    if (!res.ok) throw new Error(`Failed to load bible/${gospel}.json: ${res.status}`);
    return BibleBook.parse(await res.json());
  });
  pending.catch(() => cache.delete(gospel));
  cache.set(gospel, pending);
  return pending;
}
