import {
  parseSynopsis,
  isVerse,
  type GospelKey,
  type Pericope,
  type Section,
  type Synopsis
} from '@synopsis/schema';
import type { ParsedRef } from './refs.js';

const GOSPEL_KEYS = ['mt', 'mk', 'lk', 'jn'] as const;

export interface SynopsisModel {
  raw: Synopsis;
  byId: Map<string, Pericope>;
  resolveId(id: string): string;
  sectionOf(id: string): Section | undefined;
  gospelsPresent(p: Pericope): GospelKey[];
  resolveRef(ref: ParsedRef): { id: string; gospel: GospelKey } | null;
}

/** Build derived indexes from already-parsed data. Pure (no I/O). */
export function buildModel(data: unknown): SynopsisModel {
  const raw = parseSynopsis(data);

  const byId = new Map<string, Pericope>();
  for (const p of raw.pericopes) byId.set(p.id, p);

  const sectionByPericope = new Map<string, Section>();
  for (const s of raw.sections) {
    for (const pid of s.pericopeIds) sectionByPericope.set(pid, s);
  }

  // reverse index: "gospel-chapter-verse" -> pericope id, built from columns
  const verseToPericope = new Map<string, string>();
  for (const p of raw.pericopes) {
    for (const g of GOSPEL_KEYS) {
      const col = p.columns[g];
      if (!col) continue;
      for (const seg of col.segments) {
        for (const item of seg.items) {
          if (!isVerse(item)) continue;
          const key = `${g}-${seg.chapter}-${item.v}`;
          if (!verseToPericope.has(key)) verseToPericope.set(key, p.id);
        }
      }
    }
  }

  function resolveId(id: string): string {
    return raw.aliases[id] ?? id;
  }

  function gospelsPresent(p: Pericope): GospelKey[] {
    return GOSPEL_KEYS.filter((g) => p.columns[g] !== null);
  }

  function resolveRef(ref: ParsedRef): { id: string; gospel: GospelKey } | null {
    if (ref.verse !== undefined) {
      const id = verseToPericope.get(`${ref.gospel}-${ref.chapter}-${ref.verse}`);
      if (id) return { id, gospel: ref.gospel };
    }
    // chapter-only or verse miss: first pericope containing that chapter
    for (const p of raw.pericopes) {
      const col = p.columns[ref.gospel];
      if (!col) continue;
      if (col.segments.some((seg) => seg.chapter === ref.chapter)) {
        return { id: p.id, gospel: ref.gospel };
      }
    }
    return null;
  }

  return {
    raw,
    byId,
    resolveId,
    sectionOf: (id) => sectionByPericope.get(id),
    gospelsPresent,
    resolveRef
  };
}

let cached: SynopsisModel | null = null;

/** Fetch + validate + index synopsis.json once. Safe to call per page (memoized). */
export async function loadSynopsis(fetchFn: typeof fetch): Promise<SynopsisModel> {
  if (cached) return cached;
  const res = await fetchFn('/data/synopsis.json');
  if (!res.ok) throw new Error(`Failed to load synopsis.json: ${res.status}`);
  cached = buildModel(await res.json());
  return cached;
}
