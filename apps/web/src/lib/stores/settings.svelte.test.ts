import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsStore } from './settings.svelte.js';

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
  it('defaults to light/md/calibri/highlight', () => {
    installStorage();
    const s = new SettingsStore();
    expect(s.theme).toBe('light');
    expect(s.fontSize).toBe('md');
    expect(s.readingFont).toBe('calibri');
    expect(s.highlightParallels).toBe(true);
  });

  it('persists changes under synopsis:settings', () => {
    const store = installStorage();
    const s = new SettingsStore();
    s.setTheme('dark');
    s.setFontSize('lg');
    s.setReadingFont('georgia');
    expect(JSON.parse(store.get('synopsis:settings')!)).toEqual({
      theme: 'dark',
      fontSize: 'lg',
      readingFont: 'georgia',
      highlightParallels: true
    });
  });

  it('migrates legacy sepia theme to light and ignores legacy serif', () => {
    const store = installStorage();
    store.set(
      'synopsis:settings',
      JSON.stringify({ theme: 'sepia', fontSize: 'sm', serif: false, highlightParallels: false })
    );
    const s = new SettingsStore();
    expect(s.theme).toBe('light');
    expect(s.fontSize).toBe('sm');
    expect(s.readingFont).toBe('calibri');
    expect(s.highlightParallels).toBe(false);
  });

  it('rejects unknown reading font and keeps default', () => {
    const store = installStorage();
    store.set('synopsis:settings', JSON.stringify({ readingFont: 'bogus' }));
    const s = new SettingsStore();
    expect(s.readingFont).toBe('calibri');
  });
});
