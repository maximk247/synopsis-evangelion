import { loadSynopsis } from '$lib/data/synopsis.js';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const model = await loadSynopsis(fetch);
  return { appendix: model.raw.appendix2 };
};
