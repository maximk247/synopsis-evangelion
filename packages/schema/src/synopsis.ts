import { z } from 'zod';

export const GOSPELS = ['mt', 'mk', 'lk', 'jn'] as const;
export type GospelKey = (typeof GOSPELS)[number];

/** Падежные формы для подписей колонок (НЕ конкатенировать имя + "а"). */
export const GOSPEL_LABELS: Record<GospelKey, { abbr: string; nom: string; gen: string }> = {
  mt: { abbr: 'Мф', nom: 'Матфей', gen: 'Матфея' },
  mk: { abbr: 'Мк', nom: 'Марк', gen: 'Марка' },
  lk: { abbr: 'Лк', nom: 'Лука', gen: 'Луки' },
  jn: { abbr: 'Ин', nom: 'Иоанн', gen: 'Иоанна' },
};

/** Ссылка «ранее/далее» на сегменте колонки. */
export const RefLink = z.object({
  ref: z.string(), // "3:21–22"
  p: z.string(), // id перикопы-цели: "21"
  pRaw: z.string(), // исходная строка номера из PDF
});
export type RefLink = z.infer<typeof RefLink>;

/** Элемент колонки — либо стих, либо заметка (взаимоисключающие формы). */
export const VerseItem = z.object({
  v: z.number().int(), // номер стиха
  suf: z.string(), // "", "а", "б", "ба", "аб"
  t: z.string(), // текст стиха
});
export type VerseItem = z.infer<typeof VerseItem>;

export const NoteItem = z.object({ note: z.string() });
export type NoteItem = z.infer<typeof NoteItem>;

export const ColumnItem = z.union([VerseItem, NoteItem]);
export type ColumnItem = z.infer<typeof ColumnItem>;
export const isVerse = (i: ColumnItem): i is VerseItem => 'v' in i;

export const Segment = z.object({
  gospel: z.enum(GOSPELS),
  chapter: z.number().int(),
  prev: RefLink.nullable(), // ключ всегда есть, значение может быть null
  next: RefLink.nullable(),
  items: z.array(ColumnItem),
});
export type Segment = z.infer<typeof Segment>;

export const Column = z.object({ segments: z.array(Segment) });
export type Column = z.infer<typeof Column>;

/** Строка параллелей: любые из 4 ключей -> "глава:стих" ("3:13"). */
export const AlignmentRow = z
  .object({
    mt: z.string().optional(),
    mk: z.string().optional(),
    lk: z.string().optional(),
    jn: z.string().optional(),
  })
  .strict();
export type AlignmentRow = z.infer<typeof AlignmentRow>;

/** Доп. источник (напр. «1Кор.15» в перикопе о Воскресении). */
export const Extra = z.object({
  source: z.string(),
  items: z.array(VerseItem),
});
export type Extra = z.infer<typeof Extra>;

export const Pericope = z.object({
  id: z.string(), // "21", "51.1", "99.8"
  title: z.string(),
  place: z.string().nullable(), // место/датировка или null
  pages: z.array(z.number().int()), // страницы PDF-источника
  order: z.number().int(), // порядок следования
  columns: z.object({
    mt: Column.nullable(),
    mk: Column.nullable(),
    lk: Column.nullable(),
    jn: Column.nullable(),
  }),
  // DEVIATION FROM SPEC APPENDIX A: alignment is null in 130/253 pericopes in the
  // real data (array in 123, empty array never). Appendix A declared a bare array;
  // making it nullable is required so the actual data validates in CI.
  alignment: z.array(AlignmentRow).nullable(),
  headnote: z.string().optional(), // редкая вводная заметка
  extra: Extra.optional(),
});
export type Pericope = z.infer<typeof Pericope>;

export const Section = z.object({
  id: z.number().int(),
  title: z.string(),
  pericopeIds: z.array(z.string()),
});
export type Section = z.infer<typeof Section>;

export const GospelIndexEntry = z.object({
  ref: z.string(), // "1:1–17", "5:1–8:1"
  pericope: z.string().nullable(), // часть строк указателя пока null
  title: z.string(),
  np: z.boolean(), // относится к Нагорной проповеди
});
export type GospelIndexEntry = z.infer<typeof GospelIndexEntry>;

export const Synopsis = z.object({
  meta: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    source: z.string().optional(),
  }),
  sections: z.array(Section),
  pericopes: z.array(Pericope),
  gospelIndex: z.object({
    mt: z.array(GospelIndexEntry),
    mk: z.array(GospelIndexEntry),
    lk: z.array(GospelIndexEntry),
    jn: z.array(GospelIndexEntry),
  }),
  prefaces: z.array(z.object({ title: z.string(), paragraphs: z.array(z.string()) })),
  footnotes: z.array(
    z.object({ n: z.string(), text: z.string() }), // n — строка ("1"), не число
  ),
  appendix2: z.object({
    title: z.string(),
    intro: z.array(z.string()),
    columns: z.array(z.string()), // заголовки столбцов таблицы хронологий
    rows: z.array(z.array(z.string())), // строки одинаковой длины с columns
  }),
  aliases: z.record(z.string(), z.string()), // {"99.9":"99.8"}
});
export type Synopsis = z.infer<typeof Synopsis>;

/** Бросает ZodError, если форма не совпала. Использовать в загрузчике и в CI. */
export function parseSynopsis(data: unknown): Synopsis {
  return Synopsis.parse(data);
}
