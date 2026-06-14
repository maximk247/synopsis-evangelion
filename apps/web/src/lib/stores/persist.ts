const PREFIX = 'synopsis:';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const ls = storage();
  if (!ls) return fallback;
  try {
    const raw = ls.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota or serialization error — ignore */
  }
}
