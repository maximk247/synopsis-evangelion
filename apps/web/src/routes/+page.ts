import { loadSynopsis } from '$lib/data/synopsis.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const model = await loadSynopsis(fetch);
  const sections = model.raw.sections.map((s) => ({
    id: s.id,
    title: s.title,
    items: s.pericopeIds
      .map((pid) => {
        const p = model.byId.get(pid);
        if (!p) return null;
        return {
          id: p.id,
          title: p.title,
          place: p.place,
          present: model.gospelsPresent(p)
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }));
  return { sections };
};
