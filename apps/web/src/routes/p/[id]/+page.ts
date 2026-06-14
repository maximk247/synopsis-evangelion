import { error } from '@sveltejs/kit';
import ids from '$lib/generated/pericope-ids.json';
import { loadSynopsis } from '$lib/data/synopsis.js';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => (ids as string[]).map((id) => ({ id }));

export const load: PageLoad = async ({ params, fetch }) => {
  const model = await loadSynopsis(fetch);
  const resolvedId = model.resolveId(params.id);
  const pericope = model.byId.get(resolvedId);
  if (!pericope) throw error(404, `Перикопа ${params.id} не найдена`);

  const order = model.raw.pericopes;
  const idx = order.findIndex((p) => p.id === pericope.id);
  const prevId = idx > 0 ? order[idx - 1]!.id : undefined;
  const nextId = idx >= 0 && idx < order.length - 1 ? order[idx + 1]!.id : undefined;

  return {
    pericope,
    present: model.gospelsPresent(pericope),
    sectionTitle: model.sectionOf(pericope.id)?.title,
    prevId,
    nextId
  };
};
