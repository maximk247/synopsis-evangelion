import { GOSPELS, GOSPEL_LABELS, type GospelKey } from '@synopsis/schema';

export { GOSPELS, GOSPEL_LABELS };
export type { GospelKey };

/** "Евангелие от Луки" — genitive from the case table, never concatenation. */
export function gospelHeading(g: GospelKey): string {
  return `Евангелие от ${GOSPEL_LABELS[g].gen}`;
}

/** Short column label, e.g. "Мф". */
export function gospelAbbr(g: GospelKey): string {
  return GOSPEL_LABELS[g].abbr;
}

/** Nominative name, e.g. "Матфей". */
export function gospelNom(g: GospelKey): string {
  return GOSPEL_LABELS[g].nom;
}
