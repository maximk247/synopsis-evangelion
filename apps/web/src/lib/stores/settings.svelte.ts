import { readJSON, writeJSON } from './persist.js';

export type Theme = 'light' | 'sepia' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg';

export interface SettingsState {
  theme: Theme;
  fontSize: FontSize;
  serif: boolean;
  highlightParallels: boolean;
}

const DEFAULTS: SettingsState = {
  theme: 'light',
  fontSize: 'md',
  serif: true,
  highlightParallels: true
};

export class SettingsStore {
  theme = $state<Theme>(DEFAULTS.theme);
  fontSize = $state<FontSize>(DEFAULTS.fontSize);
  serif = $state<boolean>(DEFAULTS.serif);
  highlightParallels = $state<boolean>(DEFAULTS.highlightParallels);

  constructor() {
    const v = readJSON<SettingsState>('settings', DEFAULTS);
    this.theme = v.theme ?? DEFAULTS.theme;
    this.fontSize = v.fontSize ?? DEFAULTS.fontSize;
    this.serif = v.serif ?? DEFAULTS.serif;
    this.highlightParallels = v.highlightParallels ?? DEFAULTS.highlightParallels;
  }

  private persist() {
    writeJSON<SettingsState>('settings', {
      theme: this.theme,
      fontSize: this.fontSize,
      serif: this.serif,
      highlightParallels: this.highlightParallels
    });
  }

  /** Apply to <html> data-attributes (call from a component $effect on the client). */
  apply() {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    el.dataset.theme = this.theme;
    el.dataset.font = this.fontSize;
    el.dataset.serif = this.serif ? 'on' : 'off';
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
  setSerif(on: boolean) {
    this.serif = on;
    this.persist();
    this.apply();
  }
  setHighlightParallels(on: boolean) {
    this.highlightParallels = on;
    this.persist();
  }
}

export const settings = new SettingsStore();
