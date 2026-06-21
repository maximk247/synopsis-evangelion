import { readJSON, writeJSON } from './persist.js';
import {
  DEFAULT_READING_FONT_KEY,
  isReadingFontKey,
  readingFontValue,
  type ReadingFontKey
} from '$lib/data/fonts.js';

export type Theme = 'light' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg';

export interface SettingsState {
  theme: Theme;
  fontSize: FontSize;
  readingFont: ReadingFontKey;
  highlightParallels: boolean;
}

const DEFAULTS: SettingsState = {
  theme: 'light',
  fontSize: 'md',
  readingFont: DEFAULT_READING_FONT_KEY,
  highlightParallels: true
};

function normalizeTheme(t: unknown): Theme {
  return t === 'dark' ? 'dark' : 'light';
}

export class SettingsStore {
  theme = $state<Theme>(DEFAULTS.theme);
  fontSize = $state<FontSize>(DEFAULTS.fontSize);
  readingFont = $state<ReadingFontKey>(DEFAULTS.readingFont);
  highlightParallels = $state<boolean>(DEFAULTS.highlightParallels);

  constructor() {
    const v = readJSON<Partial<SettingsState>>('settings', DEFAULTS);
    this.theme = normalizeTheme(v.theme);
    this.fontSize = v.fontSize ?? DEFAULTS.fontSize;
    this.readingFont = isReadingFontKey(v.readingFont) ? v.readingFont : DEFAULTS.readingFont;
    this.highlightParallels = v.highlightParallels ?? DEFAULTS.highlightParallels;
  }

  private persist() {
    writeJSON<SettingsState>('settings', {
      theme: this.theme,
      fontSize: this.fontSize,
      readingFont: this.readingFont,
      highlightParallels: this.highlightParallels
    });
  }

  /** Apply to <html> (call from a component $effect on the client). */
  apply() {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    el.dataset.theme = this.theme;
    el.dataset.font = this.fontSize;
    el.style.setProperty('--reading-font', readingFontValue(this.readingFont));
  }

  setTheme(t: Theme) {
    this.theme = t;
    this.persist();
    this.apply();
  }
  setFontSize(f: FontSize) {
    this.fontSize = f;
    this.persist();
    this.apply();
  }
  setReadingFont(k: ReadingFontKey) {
    this.readingFont = k;
    this.persist();
    this.apply();
  }
  setHighlightParallels(on: boolean) {
    this.highlightParallels = on;
    this.persist();
  }
}

export const settings = new SettingsStore();
