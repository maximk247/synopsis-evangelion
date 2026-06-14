import { error } from '@sveltejs/kit';
import { GOSPELS, type GospelKey } from '$lib/data/labels.js';
import { loadSynopsis } from '$lib/data/synopsis.js';
import { buildReading } from '$lib/data/reading.js';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => GOSPELS.map((g) => ({ g }));

export const load: PageLoad = async ({ params, fetch }) => {
  const g = params.g as GospelKey;
  if (!GOSPELS.includes(g)) throw error(404, `Неизвестное Евангелие ${params.g}`);
  const model = await loadSynopsis(fetch);
  return { gospel: g, blocks: buildReading(model, g) };
};
