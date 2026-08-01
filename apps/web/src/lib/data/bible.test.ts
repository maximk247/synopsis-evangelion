import { describe, expect, it, vi } from 'vitest';
import { chapterNumbers, getChapter, loadBook, neighbourChapters, splitRuns } from './bible.js';

const book = {
  '2': { '1': 'второй-первый', '10': 'второй-десятый', '3': 'второй-третий' },
  '1': { '1': 'первый-первый' },
  '3': { '1': 'третий-первый' }
};

describe('chapterNumbers', () => {
  it('returns chapters in numeric order, not string order', () => {
    expect(chapterNumbers({ '10': {}, '2': {}, '1': {} })).toEqual([1, 2, 10]);
  });
});

describe('getChapter', () => {
  it('sorts verses numerically', () => {
    expect(getChapter(book, 2).map((v) => v.verse)).toEqual([1, 3, 10]);
    expect(getChapter(book, 2)[2]).toEqual({ verse: 10, text: 'второй-десятый' });
  });

  it('returns an empty list for a chapter that does not exist', () => {
    expect(getChapter(book, 99)).toEqual([]);
  });
});

describe('neighbourChapters', () => {
  it('gives both neighbours in the middle of the book', () => {
    expect(neighbourChapters(book, 2)).toEqual({ prev: 1, next: 3 });
  });

  it('gives null at the edges', () => {
    expect(neighbourChapters(book, 1)).toEqual({ prev: null, next: 2 });
    expect(neighbourChapters(book, 3)).toEqual({ prev: 2, next: null });
  });

  it('gives null for an unknown chapter', () => {
    expect(neighbourChapters(book, 99)).toEqual({ prev: null, next: null });
  });
});

describe('splitRuns', () => {
  const verses = [1, 2, 3, 4, 5].map((verse) => ({ verse, text: `t${verse}` }));
  const runs = (hl: number[]) =>
    splitRuns(verses, new Set(hl)).map((r) => [r.hl, r.items.map((i) => i.verse)]);

  it('merges neighbouring highlighted verses into one run', () => {
    expect(runs([2, 3, 4])).toEqual([
      [false, [1]],
      [true, [2, 3, 4]],
      [false, [5]]
    ]);
  });

  it('keeps a gap in the highlight as separate runs', () => {
    expect(runs([2, 4])).toEqual([
      [false, [1]],
      [true, [2]],
      [false, [3]],
      [true, [4]],
      [false, [5]]
    ]);
  });

  it('returns a single plain run when nothing is highlighted', () => {
    expect(runs([])).toEqual([[false, [1, 2, 3, 4, 5]]]);
  });

  it('returns nothing for an empty chapter', () => {
    expect(splitRuns([], new Set([1]))).toEqual([]);
  });
});

describe('loadBook', () => {
  it('fetches once per gospel and reuses the result', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(book)));
    const first = await loadBook('mk', fetchFn as unknown as typeof fetch);
    const second = await loadBook('mk', fetchFn as unknown as typeof fetch);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('/data/bible/mk.json');
    expect(second).toBe(first);
    expect(getChapter(first, 1)[0]?.text).toBe('первый-первый');
  });

  it('does not cache a failed load', async () => {
    const failing = vi.fn(async () => new Response('nope', { status: 404 }));
    await expect(loadBook('jn', failing as unknown as typeof fetch)).rejects.toThrow('404');

    const ok = vi.fn(async () => new Response(JSON.stringify(book)));
    await expect(loadBook('jn', ok as unknown as typeof fetch)).resolves.toBeDefined();
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
