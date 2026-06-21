export const DEFAULT_READING_FONT_KEY = 'calibri';

export const READING_FONT_OPTIONS = [
  { key: 'alegreya', label: 'Alegreya', value: "'Alegreya Variable', Georgia, serif" },
  { key: 'tahoma', label: 'Tahoma / Geneva / Verdana', value: 'Tahoma, Geneva, Verdana, sans-serif' },
  { key: 'georgia', label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
  { key: 'times', label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { key: 'palatino', label: 'Palatino', value: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { key: 'garamond', label: 'Garamond', value: "Garamond, 'Times New Roman', serif" },
  { key: 'cambria', label: 'Cambria', value: 'Cambria, Georgia, serif' },
  { key: 'bookman', label: 'Bookman', value: "'Bookman Old Style', Georgia, serif" },
  { key: 'trebuchet', label: 'Trebuchet MS', value: "'Trebuchet MS', Arial, sans-serif" },
  { key: 'verdana', label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { key: 'segoe', label: 'Segoe UI', value: "'Segoe UI', Arial, sans-serif" },
  { key: 'arial', label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { key: 'lucida', label: 'Lucida Sans', value: "'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif" },
  { key: 'calibri', label: 'Calibri', value: "Calibri, 'Segoe UI', sans-serif" },
  { key: 'courier', label: 'Courier New', value: "'Courier New', Courier, monospace" }
] as const;

export type ReadingFontKey = (typeof READING_FONT_OPTIONS)[number]['key'];

export function isReadingFontKey(v: unknown): v is ReadingFontKey {
  return typeof v === 'string' && READING_FONT_OPTIONS.some((f) => f.key === v);
}

export function readingFontValue(key: ReadingFontKey): string {
  const found = READING_FONT_OPTIONS.find((f) => f.key === key);
  const fallback = READING_FONT_OPTIONS.find((f) => f.key === DEFAULT_READING_FONT_KEY)!;
  return (found ?? fallback).value;
}
