import { loadSynopsis } from '$lib/data/synopsis.js';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const model = await loadSynopsis(fetch);
  const titles: Record<string, string> = {};
  for (const p of model.raw.pericopes) titles[p.id] = p.title;
  return { titles };
};
