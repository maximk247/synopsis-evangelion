import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsStore, FONT_SIZE_MAX, FONT_SIZE_MIN } from './settings.svelte.js';

function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear()
  });
  return store;
}
afterEach(() => vi.unstubAllGlobals());

describe('SettingsStore', () => {
  it('defaults to light/17px/calibri', () => {
    installStorage();
    const s = new SettingsStore();
    expect(s.theme).toBe('light');
    expect(s.fontSize).toBe(17);
    expect(s.readingFont).toBe('calibri');
  });

  it('persists changes under synopsis:settings', () => {
    const store = installStorage();
    const s = new SettingsStore();
    s.setTheme('dark');
    s.stepFontSize(2);
    s.setReadingFont('georgia');
    expect(JSON.parse(store.get('synopsis:settings')!)).toEqual({
      theme: 'dark',
      fontSize: 19,
      readingFont: 'georgia'
    });
  });

  it('clamps font size steps to the allowed range', () => {
    installStorage();
    const s = new SettingsStore();
    s.stepFontSize(100);
    expect(s.fontSize).toBe(FONT_SIZE_MAX);
    s.stepFontSize(-100);
    expect(s.fontSize).toBe(FONT_SIZE_MIN);
  });

  it('migrates legacy sepia theme and preset font sizes', () => {
    const store = installStorage();
    store.set(
      'synopsis:settings',
      JSON.stringify({ theme: 'sepia', fontSize: 'sm', serif: false })
    );
    const s = new SettingsStore();
    expect(s.theme).toBe('light');
    expect(s.fontSize).toBe(15);
    expect(s.readingFont).toBe('calibri');
  });

  it('rejects unknown reading font and keeps default', () => {
    const store = installStorage();
    store.set('synopsis:settings', JSON.stringify({ readingFont: 'bogus' }));
    const s = new SettingsStore();
    expect(s.readingFont).toBe('calibri');
  });
});
