import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from './synopsis.js';
import { buildSearchIndex, search } from './search.js';

const raw = JSON.parse(
  readFileSync(new URL('../../../../../data/synopsis.json', import.meta.url), 'utf8')
);
const model = buildModel(raw);
const index = buildSearchIndex(model);

describe('search', () => {
  it('full-text "Агнец Божий" finds Иоанн 1:29 and 1:36', () => {
    const res = search(index, model, 'Агнец Божий');
    expect(res.kind).toBe('text');
    if (res.kind !== 'text') return;
    const hits = res.hits.filter((h) => h.gospel === 'jn' && h.chapter === 1);
    const verses = hits.map((h) => h.verse).sort((a, b) => a - b);
    expect(verses).toContain(29);
    expect(verses).toContain(36);
  });

  it('normalizes ё/е and case', () => {
    const res = search(index, model, 'АГНЕЦ');
    expect(res.kind).toBe('text');
    if (res.kind !== 'text') return;
    expect(res.hits.length).toBeGreaterThan(0);
  });

  it('reference query "Мф 5:3" dispatches to a reference result for pericope 51.1', () => {
    const res = search(index, model, 'Мф 5:3');
    expect(res.kind).toBe('reference');
    if (res.kind !== 'reference') return;
    expect(res.pericopeId).toBe('51.1');
    expect(res.anchor).toBe('mt-5-3');
  });

  it('reference query "Мф 3:13" dispatches to pericope 21', () => {
    const res = search(index, model, 'Мф 3:13');
    expect(res.kind).toBe('reference');
    if (res.kind !== 'reference') return;
    expect(res.pericopeId).toBe('21');
  });

  it('returns empty text results for gibberish', () => {
    const res = search(index, model, 'zzzqqq');
    expect(res.kind).toBe('text');
    if (res.kind !== 'text') return;
    expect(res.hits.length).toBe(0);
  });
});
