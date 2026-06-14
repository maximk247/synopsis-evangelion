import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from './synopsis.js';

const raw = JSON.parse(
  readFileSync(new URL('../../../../../data/synopsis.json', import.meta.url), 'utf8')
);
const model = buildModel(raw);

describe('buildModel', () => {
  it('indexes pericopes by id including nested ids', () => {
    expect(model.byId.get('12')?.title).toBeTruthy();
    expect(model.byId.get('51.1')?.title).toContain('блаженств');
  });

  it('resolves aliases (99.9 -> 99.8)', () => {
    expect(model.resolveId('99.9')).toBe('99.8');
    expect(model.resolveId('21')).toBe('21');
  });

  it('maps each pericope to its section', () => {
    expect(model.sectionOf('12')).toBeTruthy();
  });

  it('reports gospel presence from columns', () => {
    const p12 = model.byId.get('12')!;
    expect(model.gospelsPresent(p12)).toEqual(['lk']);
  });

  it('resolveRef finds pericope 21 for Мф 3:13 and 51.1 for Мф 5:3', () => {
    expect(model.resolveRef({ gospel: 'mt', chapter: 3, verse: 13 })?.id).toBe('21');
    expect(model.resolveRef({ gospel: 'mt', chapter: 5, verse: 3 })?.id).toBe('51.1');
  });
});
