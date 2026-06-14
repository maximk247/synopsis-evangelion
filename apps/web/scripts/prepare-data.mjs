import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const src = resolve(repoRoot, 'data/synopsis.json');

const staticDir = resolve(here, '../static/data');
const genDir = resolve(here, '../src/lib/generated');
mkdirSync(staticDir, { recursive: true });
mkdirSync(genDir, { recursive: true });

// 1) copy the data file verbatim to be served at /data/synopsis.json
copyFileSync(src, resolve(staticDir, 'synopsis.json'));

// 2) emit the id list for prerender entries (pericope ids + alias keys)
const data = JSON.parse(readFileSync(src, 'utf8'));
const ids = new Set();
for (const p of data.pericopes) ids.add(p.id);
for (const alias of Object.keys(data.aliases ?? {})) ids.add(alias);
writeFileSync(resolve(genDir, 'pericope-ids.json'), JSON.stringify([...ids], null, 0) + '\n');

console.log(`prepare-data: copied synopsis.json, emitted ${ids.size} ids`);
