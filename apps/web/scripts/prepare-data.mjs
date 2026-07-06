import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const src = resolve(repoRoot, 'data/synopsis.json');
const canonicalDir = resolve(repoRoot, 'data/canonical');

const staticDir = resolve(here, '../static/data');
const genDir = resolve(here, '../src/lib/generated');
mkdirSync(staticDir, { recursive: true });
mkdirSync(genDir, { recursive: true });

const data = JSON.parse(readFileSync(src, 'utf8'));

// 0) fix known parser misattributions: the PDF extraction dropped these segments
//    into the wrong gospel column. "pericope:gospel:chapter" -> correct gospel.
const SEGMENT_MOVES = {
  '131:mt:12': 'jn', // Ин 12:14–19 landed in Matthew
  '131:mt:19': 'lk', // Лк 19:39–44 landed in Matthew
  '131:mk:19': 'lk', // Лк 19:37 landed in Mark
  '165:jn:28': 'mt' // Мф 28:1–10 landed in John
};

function firstVerse(seg) {
  const v = seg.items.find((it) => typeof it.v === 'number');
  return v ? v.v : Infinity;
}

for (const p of data.pericopes) {
  const moves = [];
  for (const [g, col] of Object.entries(p.columns)) {
    if (!col) continue;
    col.segments = col.segments.filter((seg) => {
      const target = SEGMENT_MOVES[`${p.id}:${g}:${seg.chapter}`];
      if (!target) return true;
      moves.push([target, seg]);
      return false;
    });
  }
  for (const [target, seg] of moves) {
    if (!p.columns[target]) p.columns[target] = { segments: [] };
    p.columns[target].segments.push(seg);
  }
  // a pericope that needed moves has scrambled segment order overall — normalize it
  if (moves.length) {
    for (const col of Object.values(p.columns)) {
      if (!col) continue;
      col.segments.sort((a, b) => a.chapter - b.chapter || firstVerse(a) - firstVerse(b));
      col.segments = col.segments.reduce((acc, seg) => {
        const prev = acc[acc.length - 1];
        if (prev && prev.chapter === seg.chapter) {
          prev.items.push(...seg.items);
          prev.next = seg.next ?? prev.next;
        } else {
          acc.push(seg);
        }
        return acc;
      }, []);
    }
  }
}

// verses missing from the JustBible dump (gaps in their data)
const CANONICAL_PATCHES = {
  'mt:26:32': 'по воскресении же Моем предварю вас в Галилее.'
};

// letters-only fingerprint: ignores digits (stray footnote markers), punctuation, case
function norm(text) {
  return text.toLowerCase().replace(/[^а-яёa-z]/g, '');
}

/**
 * The parser turns some verses into chains of unnumbered note lines (small print,
 * broken verse-number detection). Match each chain against the canonical chapter
 * text and convert it back to numbered verses; chains that don't match (editorial
 * notes, cross-refs) are left untouched.
 */
function convertNoteGroups(seg, chapterVerses) {
  const existing = new Set(seg.items.filter((it) => typeof it.v === 'number').map((it) => it.v));
  const out = [];
  let converted = 0;
  let i = 0;
  while (i < seg.items.length) {
    const item = seg.items[i];
    if (typeof item.note !== 'string') {
      out.push(item);
      i += 1;
      continue;
    }
    // collect the whole consecutive note chain
    let j = i;
    const parts = [];
    while (j < seg.items.length && typeof seg.items[j].note === 'string') {
      parts.push(seg.items[j].note);
      j += 1;
    }
    const group = norm(parts.join(' '));

    // find the canonical verse this chain starts with
    let start = null;
    for (const [vStr, text] of Object.entries(chapterVerses ?? {})) {
      const cv = norm(text);
      const probe = Math.min(20, cv.length, group.length);
      if (probe >= 12 && group.slice(0, probe) === cv.slice(0, probe)) {
        start = Number(vStr);
        break;
      }
    }

    // walk canonical verses while they keep consuming the chain
    let ok = false;
    const emitted = [];
    if (start !== null && !existing.has(start)) {
      let rest = group;
      let v = start;
      while (rest.length > 0) {
        const text = chapterVerses[String(v)];
        if (text === undefined || existing.has(v)) break;
        const cv = norm(text);
        if (rest.startsWith(cv)) {
          emitted.push({ v, suf: '', t: text });
          rest = rest.slice(cv.length);
          v += 1;
        } else if (cv.startsWith(rest) && rest.length >= 12) {
          emitted.push({ v, suf: '', t: text }); // chain ends mid-verse
          rest = '';
        } else {
          break;
        }
      }
      ok = rest.length === 0 && emitted.length > 0;
    }

    if (ok) {
      for (const e of emitted) existing.add(e.v);
      out.push(...emitted);
      converted += emitted.length;
    } else {
      out.push(...seg.items.slice(i, j));
    }
    i = j;
  }
  seg.items = out;
  return converted;
}

// 1) replace whole-verse texts with the canonical Synodal text (data/canonical/,
//    fetched by scripts/fetch-canonical.mjs) — the PDF extraction garbles some
//    verses. Half-verses (suf "а"/"б") keep the printed split and are left as is.
const GOSPELS = ['mt', 'mk', 'lk', 'jn'];
let replaced = 0;
let kept = 0;
let missing = 0;
let denoted = 0;

for (const g of GOSPELS) {
  const path = resolve(canonicalDir, `${g}.json`);
  if (!existsSync(path)) {
    console.warn(`prepare-data: no canonical text for ${g} — run scripts/fetch-canonical.mjs`);
    continue;
  }
  const canonical = JSON.parse(readFileSync(path, 'utf8'));
  for (const p of data.pericopes) {
    const col = p.columns[g];
    if (!col) continue;
    for (const seg of col.segments) {
      denoted += convertNoteGroups(seg, canonical[String(seg.chapter)]);
      for (const item of seg.items) {
        if (typeof item.t !== 'string' || typeof item.v !== 'number') continue;
        if (item.suf) {
          kept += 1;
          continue;
        }
        const text =
          canonical[String(seg.chapter)]?.[String(item.v)] ??
          CANONICAL_PATCHES[`${g}:${seg.chapter}:${item.v}`];
        if (text === undefined) {
          missing += 1;
          console.warn(`prepare-data: no canonical verse for ${g} ${seg.chapter}:${item.v}`);
          continue;
        }
        if (item.t !== text) replaced += 1;
        item.t = text;
      }
    }
  }
}

// 2) serve the (fixed) data at /data/synopsis.json
writeFileSync(resolve(staticDir, 'synopsis.json'), JSON.stringify(data), 'utf8');

// 3) emit the id list for prerender entries (pericope ids + alias keys)
const ids = new Set();
for (const p of data.pericopes) ids.add(p.id);
for (const alias of Object.keys(data.aliases ?? {})) ids.add(alias);
writeFileSync(resolve(genDir, 'pericope-ids.json'), JSON.stringify([...ids], null, 0) + '\n');

console.log(
  `prepare-data: ${replaced} verses replaced with canonical text, ` +
    `${denoted} note lines converted to verses, ${kept} half-verses kept, ` +
    `${missing} missing; emitted ${ids.size} ids`
);
