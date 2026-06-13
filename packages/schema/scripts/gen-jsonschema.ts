import { writeFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Synopsis } from '../src/synopsis.js';

const outUrl = new URL('../synopsis.schema.json', import.meta.url);
const schema = zodToJsonSchema(Synopsis, 'Synopsis');
writeFileSync(outUrl, JSON.stringify(schema, null, 2) + '\n');
console.log('Wrote packages/schema/synopsis.schema.json');
