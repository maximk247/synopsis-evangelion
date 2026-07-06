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

/** Book-internal markers like "(НП)" (Нагорная Проповедь) are noise for the reader. */
function stripMarkers(text: string): string {
  return text.replace(/\(НП\)\s*/gu, '');
}

/**
 * Printed cross-references the parser captured as note lines: "(ранее 13:10–17;",
 * "см.Мф.18:10–14; п.88.1)", "п.149)22:54а;", "М.к". They may be split across
 * several lines, so we also drop lines that consist of reference tokens only.
 * NB: no `\b` here — JS word boundaries are ASCII-only and never fire after cyrillic.
 */
const REF_TOKEN = String.raw`(?:(?:Мф|Мк|Лк|Ин)?\s*\.?\s*\d+(?::\d+[а-яё]?)?(?:[–—-]\d+(?::\d+[а-яё]?)?)?[а-яё]?|п\.?\s*\d+(?:\.\d+)?[а-яё]?|гл\.?\s*\d+)`;
const REF_NOTE_PATTERNS = [
  /^\(?\s*(ранее|далее)(?![а-яё])/iu,
  /^\(?\s*см\s*\./iu,
  // a whole line of tokens, each optionally closed with ")" and separated by ";" or ","
  new RegExp(String.raw`^\(?\s*(?:${REF_TOKEN}\)?[;,]?\s*)+$`, 'iu'),
  // stray gospel-abbreviation fragments like "М.к"
  /^[а-яё]{1,2}\s*\.\s*[а-яё]{1,2}\.?$/iu
];

function isRefNote(text: string): boolean {
  return REF_NOTE_PATTERNS.some((re) => re.test(text.trim()));
}

/** Hand-checked titles the extraction garbled beyond generic fixes. */
const TITLE_PATCHES: Record<string, string> = {
  '156':
    'Последняя попытка Пилата отпустить Господа («се, Человек», «се, Царь ваш»); предание Господа на распятие'
};

/** Build derived indexes from already-parsed data. Pure (no I/O). */
export function buildModel(data: unknown): SynopsisModel {
  const raw = parseSynopsis(data);

  for (const p of raw.pericopes) {
    // "Цар ь" — the extraction sometimes detaches the soft sign
    p.title = TITLE_PATCHES[p.id] ?? p.title.replace(/ ь/gu, 'ь');
    // a place line wrapped in print: its tail lands in headnote ("…с Четверга 6" + "апреля…30 г")
    if (p.headnote && /^[а-яё0-9]/u.test(p.headnote.trim())) {
      p.place = [p.place, p.headnote.trim()].filter(Boolean).join(' ');
      delete p.headnote;
    }
    // title subtitle mistaken for place, real place pushed to headnote (п. 82)
    if (p.headnote && /\d+\s*г\.?$/u.test(p.headnote.trim()) && p.place && !/\d/.test(p.place)) {
      p.title = `${p.title.replace(/\.$/u, '')}. ${p.place}`;
      p.place = p.headnote.trim();
      delete p.headnote;
    }
    // source sometimes glues place and year together: "Иерихон30 г"
    if (p.place) p.place = p.place.replace(/([а-яё.])(\d)/giu, '$1 $2');
    for (const g of GOSPEL_KEYS) {
      for (const seg of p.columns[g]?.segments ?? []) {
        seg.items = seg.items.filter((item) => {
          if (isVerse(item)) {
            item.t = stripMarkers(item.t);
            return true;
          }
          item.note = stripMarkers(item.note).trim();
          return item.note.length > 0 && !isRefNote(item.note);
        });
      }
    }
    if (p.extra) for (const v of p.extra.items) v.t = stripMarkers(v.t);
  }

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
