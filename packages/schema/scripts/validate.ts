import { readFileSync } from 'node:fs';
import { Synopsis } from '../src/synopsis.js';

const dataUrl = new URL('../../../data/synopsis.json', import.meta.url);
const json: unknown = JSON.parse(readFileSync(dataUrl, 'utf8'));

const result = Synopsis.safeParse(json);
if (!result.success) {
  console.error(result.error.issues.slice(0, 20));
  process.exit(1);
}
console.log(`OK: ${result.data.pericopes.length} перикоп, схема валидна.`);
