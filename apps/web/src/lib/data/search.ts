import { isVerse, type GospelKey } from '@synopsis/schema';
import type { SynopsisModel } from './synopsis.js';
import { parseRef } from './refs.js';

export interface VerseRecord {
  pid: string;
  gospel: GospelKey;
  chapter: number;
  verse: number;
  suf: string;
  text: string;
}

export interface SearchIndex {
  records: VerseRecord[];
  /** token -> sorted unique record indices */
  postings: Map<string, number[]>;
}

const GOSPEL_KEYS = ['mt', 'mk', 'lk', 'jn'] as const;

/** Lowercase, ё->е, drop everything but cyrillic/latin/digits, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

export function buildSearchIndex(model: SynopsisModel): SearchIndex {
  const records: VerseRecord[] = [];
  for (const p of model.raw.pericopes) {
    for (const g of GOSPEL_KEYS) {
      const col = p.columns[g];
      if (!col) continue;
      for (const seg of col.segments) {
        for (const item of seg.items) {
          if (!isVerse(item)) continue;
          records.push({
            pid: p.id,
            gospel: g,
            chapter: seg.chapter,
            verse: item.v,
            suf: item.suf,
            text: item.t
          });
        }
      }
    }
  }

  const postings = new Map<string, number[]>();
  records.forEach((rec, i) => {
    const seen = new Set<string>();
    for (const tok of tokenize(rec.text)) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      const arr = postings.get(tok);
      if (arr) arr.push(i);
      else postings.set(tok, [i]);
    }
  });

  return { records, postings };
}

export interface ReferenceResult {
  kind: 'reference';
  pericopeId: string;
  anchor: string;
  gospel: GospelKey;
}
export interface TextResult {
  kind: 'text';
  hits: VerseRecord[];
}
export type SearchResult = ReferenceResult | TextResult;

const MAX_HITS = 100;

export function search(index: SearchIndex, model: SynopsisModel, query: string): SearchResult {
  const trimmed = query.trim();
  if (!trimmed) return { kind: 'text', hits: [] };

  // 1) reference dispatch
  const ref = parseRef(trimmed);
  if (ref) {
    const resolved = model.resolveRef(ref);
    if (resolved) {
      const anchor =
        ref.verse !== undefined
          ? `${ref.gospel}-${ref.chapter}-${ref.verse}`
          : `${ref.gospel}-${ref.chapter}`;
      return { kind: 'reference', pericopeId: resolved.id, anchor, gospel: ref.gospel };
    }
  }

  // 2) full-text: AND of token postings, fallback to substring scan
  const tokens = normalize(trimmed).split(' ').filter(Boolean);
  if (!tokens.length) return { kind: 'text', hits: [] };

  let candidate: number[] | null = null;
  for (const tok of tokens) {
    const posting = index.postings.get(tok);
    if (!posting) {
      candidate = [];
      break;
    }
    candidate = candidate === null ? posting.slice() : intersect(candidate, posting);
    if (candidate.length === 0) break;
  }

  let hitIdx = candidate ?? [];
  if (hitIdx.length === 0) {
    // substring fallback over normalized text (handles partial words)
    const needle = normalize(trimmed);
    hitIdx = [];
    for (let i = 0; i < index.records.length && hitIdx.length < MAX_HITS; i++) {
      if (normalize(index.records[i]!.text).includes(needle)) hitIdx.push(i);
    }
  }

  return { kind: 'text', hits: hitIdx.slice(0, MAX_HITS).map((i) => index.records[i]!) };
}

function intersect(a: number[], b: number[]): number[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}
