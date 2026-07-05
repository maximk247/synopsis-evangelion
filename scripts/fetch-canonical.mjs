/**
 * Downloads the Synodal (RST) gospel texts from the JustBible API into
 * data/canonical/{mt,mk,lk,jn}.json — { "<chapter>": { "<verse>": "text" } }.
 *
 * These files are the reference texts: apps/web/scripts/prepare-data.mjs
 * replaces every whole-verse text from the PDF parse with the canonical one,
 * fixing extraction artifacts. Re-run only to refresh the cache:
 *
 *   node scripts/fetch-canonical.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = 'https://justbible.ru/api/bible';
const TRANSLATION = 'rst';

const BOOKS = { mt: 40, mk: 41, lk: 42, jn: 43 };

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'data', 'canonical');
mkdirSync(outDir, { recursive: true });

function cleanText(text) {
  // JustBible leaves empty brackets where the LXX variant numbers were
  return text
    .replace(/\s*\[\s*\]\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

for (const [abbrev, bookNo] of Object.entries(BOOKS)) {
  const url = new URL(API_URL);
  url.searchParams.set('translation', TRANSLATION);
  url.searchParams.set('book', String(bookNo));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`JustBible ${abbrev} failed: ${res.status} ${res.statusText}`);
  const chapters = await res.json();

  const cleaned = {};
  for (const [ch, verses] of Object.entries(chapters)) {
    if (!Number.isInteger(Number(ch))) continue;
    cleaned[ch] = {};
    for (const [v, t] of Object.entries(verses)) cleaned[ch][v] = cleanText(t);
  }

  writeFileSync(join(outDir, `${abbrev}.json`), `${JSON.stringify(cleaned, null, 1)}\n`, 'utf8');
  console.log(`fetched ${abbrev}: ${Object.keys(cleaned).length} chapters`);
}
