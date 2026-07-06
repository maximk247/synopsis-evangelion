import { readJSON, writeJSON } from './persist.js';
import {
  DEFAULT_READING_FONT_KEY,
  isReadingFontKey,
  readingFontValue,
  type ReadingFontKey
} from '$lib/data/fonts.js';

export type Theme = 'light' | 'dark';

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 22;
export const FONT_SIZE_STEP = 1;

export interface SettingsState {
  theme: Theme;
  /** Base font size in px, FONT_SIZE_MIN..FONT_SIZE_MAX. */
  fontSize: number;
  readingFont: ReadingFontKey;
}

const DEFAULTS: SettingsState = {
  theme: 'light',
  fontSize: 17,
  readingFont: DEFAULT_READING_FONT_KEY
};

function normalizeTheme(t: unknown): Theme {
  return t === 'dark' ? 'dark' : 'light';
}

/** Accepts px numbers and the legacy 'sm' | 'md' | 'lg' presets. */
function normalizeFontSize(v: unknown): number {
  if (v === 'sm') return 15;
  if (v === 'lg') return 20;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(v)));
  }
  return DEFAULTS.fontSize;
}

export class SettingsStore {
  theme = $state<Theme>(DEFAULTS.theme);
  fontSize = $state<number>(DEFAULTS.fontSize);
  readingFont = $state<ReadingFontKey>(DEFAULTS.readingFont);

  constructor() {
    const v = readJSON<Partial<SettingsState>>('settings', DEFAULTS);
    this.theme = normalizeTheme(v.theme);
    this.fontSize = normalizeFontSize(v.fontSize);
    this.readingFont = isReadingFontKey(v.readingFont) ? v.readingFont : DEFAULTS.readingFont;
  }

  private persist() {
    writeJSON<SettingsState>('settings', {
      theme: this.theme,
      fontSize: this.fontSize,
      readingFont: this.readingFont
    });
  }

  /** Apply to <html> (call from a component $effect on the client). */
  apply() {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    el.dataset.theme = this.theme;
    el.style.setProperty('--fs-base', `${this.fontSize}px`);
    el.style.setProperty('--reading-font', readingFontValue(this.readingFont));
  }

  setTheme(t: Theme) {
    this.theme = t;
    this.persist();
    this.apply();
  }
  stepFontSize(delta: number) {
    this.setFontSize(this.fontSize + delta);
  }
  setFontSize(px: number) {
    this.fontSize = normalizeFontSize(px);
    this.persist();
    this.apply();
  }
  setReadingFont(k: ReadingFontKey) {
    this.readingFont = k;
    this.persist();
    this.apply();
  }
}

export const settings = new SettingsStore();
