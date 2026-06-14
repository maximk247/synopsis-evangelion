import { afterEach, describe, expect, it, vi } from 'vitest';
import { readJSON, writeJSON } from './persist.js';

function installStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear()
  };
  vi.stubGlobal('localStorage', ls);
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('persist', () => {
  it('round-trips a value through the namespaced key', () => {
    const store = installStorage();
    writeJSON('theme', 'dark');
    expect(readJSON('theme', 'light')).toBe('dark');
    expect(store.has('synopsis:theme')).toBe(true);
  });

  it('returns the fallback when nothing is stored', () => {
    installStorage();
    expect(readJSON('missing', 42)).toBe(42);
  });

  it('returns the fallback when localStorage is absent (SSR)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readJSON('theme', 'light')).toBe('light');
    expect(() => writeJSON('theme', 'dark')).not.toThrow();
  });
});
