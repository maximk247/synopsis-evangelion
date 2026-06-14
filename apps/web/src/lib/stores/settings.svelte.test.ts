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
  it('defaults to light/md/serif/highlight', () => {
    installStorage();
    const s = new SettingsStore();
    expect(s.theme).toBe('light');
    expect(s.fontSize).toBe('md');
    expect(s.serif).toBe(true);
    expect(s.highlightParallels).toBe(true);
  });

  it('persists changes under synopsis:settings', () => {
    const store = installStorage();
    const s = new SettingsStore();
    s.setTheme('dark');
    s.setFontSize('lg');
    s.setSerif(false);
    expect(JSON.parse(store.get('synopsis:settings')!)).toEqual({
      theme: 'dark',
      fontSize: 'lg',
      serif: false,
      highlightParallels: true
    });
  });

  it('rehydrates persisted settings on construction', () => {
    const store = installStorage();
    store.set(
      'synopsis:settings',
      JSON.stringify({ theme: 'sepia', fontSize: 'sm', serif: false, highlightParallels: false })
    );
    const s = new SettingsStore();
    expect(s.theme).toBe('sepia');
    expect(s.highlightParallels).toBe(false);
  });
});
