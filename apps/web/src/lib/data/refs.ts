import type { GospelKey } from '@synopsis/schema';

export interface ParsedRef {
  gospel: GospelKey;
  chapter: number;
  verse: number | undefined;
}

/** Accepted spellings -> gospel key (lowercased, ё->е, dots stripped before lookup). */
const NAME_TO_GOSPEL: Record<string, GospelKey> = {
  мф: 'mt',
  мат: 'mt',
  матф: 'mt',
  матфей: 'mt',
  матфея: 'mt',
  мк: 'mk',
  мар: 'mk',
  марк: 'mk',
  марка: 'mk',
  лк: 'lk',
  лук: 'lk',
  лука: 'lk',
  луки: 'lk',
  ин: 'jn',
  иоанн: 'jn',
  иоанна: 'jn',
  иоан: 'jn'
};

/**
 * Parse a scripture reference like "Мф 5:3", "Ин.1:29", "Лк 6", "Матфей 3:13".
 * Returns null when the input is not a recognizable reference.
 */
export function parseRef(input: string): ParsedRef | null {
  const text = input.trim();
  if (!text) return null;
  // name, then chapter, optional :verse — separators may be space or dot.
  const m = /^([А-Яа-яЁё]+)\.?\s*(\d+)(?::(\d+))?/.exec(text);
  if (!m) return null;
  const name = m[1]!.toLowerCase().replace(/ё/g, 'е');
  const gospel = NAME_TO_GOSPEL[name];
  if (!gospel) return null;
  const chapter = Number(m[2]);
  const verse = m[3] !== undefined ? Number(m[3]) : undefined;
  return { gospel, chapter, verse };
}
