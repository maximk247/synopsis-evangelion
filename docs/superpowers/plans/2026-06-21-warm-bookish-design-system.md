# Warm-Bookish Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести apps/web на тёплую книжную дизайн-систему по образцу read_kings: палитра amber/stone (2 темы), шрифты Inter+Alegreya self-host, выбор шрифта чтения и единая типографическая шкала.

**Architecture:** Компоненты уже используют CSS-переменные, поэтому ядро редизайна - переписать токены в app.css (каскадно перекрашивает весь UI) плюс точечная логика: стор настроек (тип Theme сужается до light|dark, удаляется serif, добавляется readingFont), новый модуль данных шрифтов и селектор в drawer. Дальше - типографическая шлифовка локальных размеров под тип-шкалу.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes), adapter-static (prerender), Vite 6, vitest, @fontsource-variable.

## Global Constraints

- Менеджер пакетов pnpm, монорепо. Команды: `pnpm --filter web <script>`.
- Стиль текста (правила пользователя): без стрелок (→ ⇒), без длинных/средних тире (— –), без ёлочек (« »). В коде, комментариях, коммитах - дефис, двоеточие, прямые кавычки.
- Имена существующих CSS-переменных сохраняются (--bg, --bg-soft, --surface, --fg, --fg-muted, --border, --accent, --accent-soft, --highlight и др.), чтобы не ломать компоненты.
- Шрифты только self-host (офлайн, prerender), без внешних запросов к Google Fonts.
- Палитра, дефолт шрифта (calibri) и значения берутся из spec: docs/superpowers/specs/2026-06-21-warm-bookish-design-system-design.md.
- Темы ровно две: light, dark. Sepia удаляется, старое значение мигрирует в light.
- localStorage-ключ настроек: `synopsis:settings` (не менять).
- Все анимации/переходы уважают prefers-reduced-motion.

---

## Файловая структура

- Modify: `apps/web/package.json` - добавить @fontsource-variable/inter, @fontsource-variable/alegreya.
- Create: `apps/web/src/lib/data/fonts.ts` - список шрифтов чтения, дефолт, хелперы.
- Modify: `apps/web/src/lib/stores/settings.svelte.ts` - Theme light|dark, readingFont, миграция, apply().
- Modify: `apps/web/src/lib/stores/settings.svelte.test.ts` - тесты под новую модель.
- Modify: `apps/web/src/app.html` - пре-гидрационный скрипт (theme/font, без serif).
- Modify: `apps/web/src/app.css` - токены, темы, импорт шрифтов, тип-шкала, базовые стили, .verse-text, скроллбары, reduced-motion.
- Modify: `apps/web/src/lib/components/SettingsDrawer.svelte` - 2 темы, селектор шрифта, без тумблера засечек.
- Modify: `apps/web/src/routes/+layout.svelte` - шапка, бренд-марка (типографика/акцент).
- Modify: `apps/web/src/routes/+page.svelte` - заголовки оглавления под тип-шкалу.
- Modify: `apps/web/src/routes/read/[g]/+page.svelte` - маркеры/переключатель под тип-шкалу.
- Modify: `apps/web/src/routes/p/[id]/+page.svelte` - заголовок перикопы под тип-шкалу.
- Modify: `apps/web/src/routes/prefaces/+page.svelte` - заголовок под тип-шкалу.
- Verify: `apps/web/src/lib/components/{GospelPresence,ColumnTabs,RefLinkBadge,VerseItem,NoteItem,Breadcrumbs,Pager,BookmarkButton,ScrollTable,PericopeColumns,SearchBox}.svelte` и routes/{bookmarks,footnotes,appendix,search} - перекрашиваются токенами, визуальная проверка в обеих темах.

---

### Task 1: Модуль данных шрифтов чтения (fonts.ts)

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/data/fonts.ts`
- Test: `apps/web/src/lib/data/fonts.test.ts`

**Interfaces:**
- Produces: `READING_FONT_OPTIONS` (readonly массив `{ key, label, value }`), `type ReadingFontKey`, `DEFAULT_READING_FONT_KEY = 'calibri'`, `readingFontValue(key): string`, `isReadingFontKey(v: unknown): v is ReadingFontKey`.

- [ ] **Step 1: Установить шрифтовые пакеты**

Run: `pnpm --filter web add -D @fontsource-variable/inter @fontsource-variable/alegreya`
Expected: package.json apps/web получает обе зависимости, lockfile обновлён.

- [ ] **Step 2: Написать падающий тест**

Create `apps/web/src/lib/data/fonts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_READING_FONT_KEY,
  READING_FONT_OPTIONS,
  isReadingFontKey,
  readingFontValue
} from './fonts.js';

describe('reading fonts', () => {
  it('has 15 options and calibri default', () => {
    expect(READING_FONT_OPTIONS).toHaveLength(15);
    expect(DEFAULT_READING_FONT_KEY).toBe('calibri');
    expect(READING_FONT_OPTIONS.some((f) => f.key === 'calibri')).toBe(true);
  });

  it('validates keys', () => {
    expect(isReadingFontKey('georgia')).toBe(true);
    expect(isReadingFontKey('nope')).toBe(false);
    expect(isReadingFontKey(null)).toBe(false);
  });

  it('returns the css stack for a key and falls back to default', () => {
    expect(readingFontValue('georgia')).toContain('Georgia');
    expect(readingFontValue('calibri')).toContain('Calibri');
  });
});
```

- [ ] **Step 3: Запустить тест - убедиться, что падает**

Run: `pnpm --filter web exec vitest run src/lib/data/fonts.test.ts`
Expected: FAIL (модуль ./fonts.js не найден).

- [ ] **Step 4: Реализовать модуль**

Create `apps/web/src/lib/data/fonts.ts`:

```ts
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
```

- [ ] **Step 5: Запустить тест - убедиться, что проходит**

Run: `pnpm --filter web exec vitest run src/lib/data/fonts.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/data/fonts.ts apps/web/src/lib/data/fonts.test.ts
git commit -m "feat(web): reading font options module + fontsource deps"
```

---

### Task 2: Рефакторинг стора настроек

**Files:**
- Modify: `apps/web/src/lib/stores/settings.svelte.ts`
- Modify: `apps/web/src/lib/stores/settings.svelte.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_READING_FONT_KEY`, `isReadingFontKey`, `readingFontValue`, `ReadingFontKey` из Task 1.
- Produces: `type Theme = 'light' | 'dark'`, `SettingsStore` с полями `theme, fontSize, readingFont, highlightParallels` и методами `setTheme, setFontSize, setReadingFont, setHighlightParallels, apply`. `apply()` ставит data-theme, data-font и inline `--reading-font` на documentElement.

- [ ] **Step 1: Переписать тесты (падающие)**

Replace the full contents of `apps/web/src/lib/stores/settings.svelte.test.ts`:

```ts
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
```

- [ ] **Step 2: Запустить тест - убедиться, что падает**

Run: `pnpm --filter web exec vitest run src/lib/stores/settings.svelte.test.ts`
Expected: FAIL (s.readingFont/setReadingFont не существуют, тип ещё содержит sepia).

- [ ] **Step 3: Переписать стор**

Replace the full contents of `apps/web/src/lib/stores/settings.svelte.ts`:

```ts
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
```

- [ ] **Step 4: Запустить тест - убедиться, что проходит**

Run: `pnpm --filter web exec vitest run src/lib/stores/settings.svelte.test.ts`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/stores/settings.svelte.ts apps/web/src/lib/stores/settings.svelte.test.ts
git commit -m "refactor(web): settings store light/dark + reading font, drop serif/sepia"
```

---

### Task 3: Пре-гидрационный скрипт (app.html)

**Files:**
- Modify: `apps/web/src/app.html`

**Interfaces:**
- Consumes: localStorage `synopsis:settings` (поля theme, fontSize).

- [ ] **Step 1: Обновить инлайн-скрипт**

В `apps/web/src/app.html` заменить блок `<script> ... </script>` (строки 7-17) на:

```html
    <script>
      try {
        const s = localStorage.getItem('synopsis:settings');
        if (s) {
          const v = JSON.parse(s);
          document.documentElement.dataset.theme = v.theme === 'dark' ? 'dark' : 'light';
          if (v.fontSize) document.documentElement.dataset.font = v.fontSize;
        }
      } catch (e) {}
    </script>
```

Примечание: `--reading-font` выставляется стором в apply() при гидрации. Дефолт (calibri) - системный шрифт без сетевой загрузки, поэтому заметного FOUC нет; для нестандартного шрифта возможна кратковременная подмена - это приемлемо.

- [ ] **Step 2: Проверка сборки**

Run: `pnpm --filter web build`
Expected: сборка проходит без ошибок.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app.html
git commit -m "chore(web): pre-hydration script applies light/dark only"
```

---

### Task 4: Переписать app.css (токены, темы, шрифты, тип-шкала)

**Files:**
- Modify: `apps/web/src/app.css`

**Interfaces:**
- Produces: CSS-переменные палитры (имена сохранены + новые: --muted, --card, --hover, --fg-secondary, --border-strong, --accent-medium, --accent-subtle, --accent-wash, --accent-contrast, --active-verse, --selected-verse), --reading-font (дефолт), тип-шкала (--fs-*, --fw-*, --lh-*), классы-утилиты .overline / .caption.

- [ ] **Step 1: Заменить полностью содержимое app.css**

Replace the full contents of `apps/web/src/app.css`:

```css
@import '@fontsource-variable/inter';
@import '@fontsource-variable/alegreya';

:root {
  /* palette - light (warm cream) */
  --bg: #fbf7ed;
  --bg-soft: #f2eadf;
  --muted: #f2eadf;
  --surface: #fffaf0;
  --card: #fffaf0;
  --hover: #f8efd9;
  --fg: #1c1917;
  --fg-muted: #a8a29e;
  --fg-secondary: #57534e;
  --border: #e7dccb;
  --border-strong: #d8c9a8;
  --accent: #78350f;
  --accent-medium: #92400e;
  --accent-subtle: #da8107;
  --accent-soft: rgba(120, 53, 15, 0.1);
  --accent-wash: rgba(120, 53, 15, 0.1);
  --accent-contrast: #fffaf0;
  --highlight: #ffefc2;
  --active-verse: #ffefc2;
  --selected-verse: #fff7e7;

  /* shadows (warm) */
  --shadow-sm: 0 1px 2px rgba(80, 58, 26, 0.08), 0 1px 6px rgba(80, 58, 26, 0.05);
  --shadow-md: 0 10px 28px rgba(80, 58, 26, 0.12);

  /* radii */
  --radius: 8px;
  --radius-sm: 6px;
  --radius-pill: 999px;

  /* font families */
  --font-ui: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-serif: 'Alegreya Variable', Georgia, 'Times New Roman', serif;
  --reading-font: Calibri, 'Segoe UI', sans-serif;

  /* type scale */
  --fs-base: 17px;
  --fs-overline: 0.75rem;
  --fs-caption: 0.8rem;
  --fs-ui-sm: 0.9rem;
  --fs-body: 1rem;
  --fs-reading: 1.0625rem;
  --fs-h3: 1.15rem;
  --fs-h2: 1.35rem;
  --fs-h1: 1.65rem;
  --fs-display: 2rem;

  /* weights */
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;

  /* line-heights */
  --lh-tight: 1.2;
  --lh-snug: 1.3;
  --lh-normal: 1.55;
  --lh-reading: 1.85;
}

:root[data-theme='dark'] {
  --bg: #1c1917;
  --bg-soft: #161412;
  --muted: #161412;
  --surface: #292524;
  --card: #292524;
  --hover: #2a2827;
  --fg: #fafaf7;
  --fg-muted: #a8a29e;
  --fg-secondary: #78716c;
  --border: #44403c;
  --border-strong: #57534e;
  --accent: #d97706;
  --accent-medium: #b45309;
  --accent-subtle: #f59e0b;
  --accent-soft: #292524;
  --accent-wash: #292524;
  --accent-contrast: #1c1917;
  --highlight: #451a03;
  --active-verse: #451a03;
  --selected-verse: #451a03;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.25), 0 1px 10px rgba(0, 0, 0, 0.18);
  --shadow-md: 0 16px 40px rgba(0, 0, 0, 0.28);
}

:root[data-font='sm'] {
  --fs-base: 15px;
}
:root[data-font='md'] {
  --fs-base: 17px;
}
:root[data-font='lg'] {
  --fs-base: 20px;
}

* {
  box-sizing: border-box;
}

html {
  background: var(--bg);
  scroll-padding-top: 5.5rem;
}

body {
  margin: 0;
  color: var(--fg);
  background: var(--bg);
  font-family: var(--font-ui);
  font-size: var(--fs-base);
  line-height: var(--lh-normal);
  min-height: 100vh;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  font-family: var(--font-serif);
  font-weight: var(--fw-semibold);
  line-height: var(--lh-snug);
}
h1 {
  font-size: var(--fs-h1);
  font-weight: var(--fw-bold);
  line-height: var(--lh-tight);
}
h2 {
  font-size: var(--fs-h2);
}
h3 {
  font-size: var(--fs-h3);
}

.overline {
  font-size: var(--fs-overline);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: var(--fw-semibold);
  line-height: var(--lh-snug);
  color: var(--fg-muted);
}
.caption {
  font-size: var(--fs-caption);
  line-height: var(--lh-normal);
  color: var(--fg-muted);
}

a {
  color: var(--accent);
  text-decoration: none;
  text-underline-offset: 0.18em;
}
a:hover {
  text-decoration: underline;
}

:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent) 70%, transparent);
  outline-offset: 3px;
}

::selection {
  background: var(--accent-soft);
  color: var(--fg);
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  color: inherit;
}

input[type='search'],
input[type='text'] {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  color: var(--fg);
  box-shadow: var(--shadow-sm);
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease;
}
input[type='search']:hover,
input[type='text']:hover {
  border-color: var(--border-strong);
}
input[type='search']:focus,
input[type='text']:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent);
  outline: none;
}

.verse-text {
  font-family: var(--reading-font);
  line-height: var(--lh-reading);
  letter-spacing: 0.01em;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--fg-muted);
}
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 2: Проверка сборки + типов**

Run: `pnpm --filter web build && pnpm --filter web typecheck`
Expected: обе команды зелёные.

- [ ] **Step 3: Визуальная проверка**

Run: `pnpm --filter web dev`
Открыть главную; переключить тему через drawer (после Task 5 будут только light/dark - пока проверить, что light кремовая, dark stone, текст читаем, шрифты Inter/Alegreya загрузились в Network).
Expected: тёплая кремовая/тёмная палитра, янтарные акценты, ничего синего.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app.css
git commit -m "feat(web): warm-bookish tokens, themes, fonts, type scale"
```

---

### Task 5: SettingsDrawer - 2 темы и селектор шрифта

**Files:**
- Modify: `apps/web/src/lib/components/SettingsDrawer.svelte`

**Interfaces:**
- Consumes: `settings` (readingFont, setReadingFont) из Task 2; `READING_FONT_OPTIONS` из Task 1.

- [ ] **Step 1: Обновить скрипт компонента**

В `apps/web/src/lib/components/SettingsDrawer.svelte` заменить импорт и массив тем (строки 1-13). Новый верх `<script>`:

```svelte
<script lang="ts">
  import { settings, type Theme, type FontSize } from '$lib/stores/settings.svelte.js';
  import { READING_FONT_OPTIONS, type ReadingFontKey } from '$lib/data/fonts.js';

  let { open = $bindable() }: { open: boolean } = $props();

  let panel = $state<HTMLDivElement | null>(null);
  let lastFocused: HTMLElement | null = null;

  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Светлая' },
    { value: 'dark', label: 'Тёмная' }
  ];
  const sizes: { value: FontSize; label: string }[] = [
    { value: 'sm', label: 'A−' },
    { value: 'md', label: 'A' },
    { value: 'lg', label: 'A+' }
  ];
</script>
```

(Остальной скрипт - close/onKeydown/$effect - оставить без изменений.)

- [ ] **Step 2: Заменить fieldset засечек на селектор шрифта**

Удалить fieldset "Текст" с тумблером засечек (строки 99-109 в исходнике) и вставить на его место:

```svelte
    <fieldset>
      <legend>Шрифт</legend>
      <select
        class="font-select"
        value={settings.readingFont}
        onchange={(e) => settings.setReadingFont(e.currentTarget.value as ReadingFontKey)}
        aria-label="Шрифт текста"
      >
        {#each READING_FONT_OPTIONS as f (f.key)}
          <option value={f.key}>{f.label}</option>
        {/each}
      </select>
    </fieldset>
```

- [ ] **Step 3: Добавить стиль селектора**

В блок `<style>` добавить:

```css
  .font-select {
    width: 100%;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--fg);
    cursor: pointer;
  }
  .font-select:hover {
    border-color: var(--border-strong);
  }
```

- [ ] **Step 4: Проверка типов и сборки**

Run: `pnpm --filter web typecheck && pnpm --filter web build`
Expected: зелёно (sepia удалён из типа, serif больше не используется).

- [ ] **Step 5: Визуальная проверка**

Run: `pnpm --filter web dev`
Открыть drawer: две кнопки темы (Светлая/Тёмная), размер (A−/A/A+), выпадающий список шрифтов (дефолт Calibri), подсветка параллелей. Сменить шрифт - текст евангелий на /read/lk меняется; перезагрузить - выбор сохранился.
Expected: всё работает, тема dark не показывает sepia.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/components/SettingsDrawer.svelte
git commit -m "feat(web): settings drawer - two themes + reading font selector"
```

---

### Task 6: Шапка и бренд-марка (layout)

**Files:**
- Modify: `apps/web/src/routes/+layout.svelte`

- [ ] **Step 1: Привести шапку к новым токенам**

В `<style>` файла `apps/web/src/routes/+layout.svelte`:

1. `.brand__mark` - перекрасить градиент в янтарь/золото. Заменить свойство `background` правила `.brand__mark` на:

```css
    background:
      linear-gradient(var(--surface), var(--surface)) padding-box,
      linear-gradient(135deg, var(--accent), var(--accent-subtle)) border-box;
```

2. `.links` (строка ~88) - размер навигации привязать к шкале: заменить `font-size: 0.9rem;` на `font-size: var(--fs-ui-sm);`.

3. `.brand` - заменить `font-size: 1rem;` (если присутствует в `.brand`) не трогать; добавить в `.brand` свойство `font-family: var(--font-serif);` для книжного бренда. Конкретно: в правило `.brand { ... }` добавить строку `font-family: var(--font-serif);`.

- [ ] **Step 2: Проверка сборки**

Run: `pnpm --filter web build`
Expected: проходит.

- [ ] **Step 3: Визуальная проверка**

Run: `pnpm --filter web dev`
Шапка: бренд-марка янтарная, навигация на тёплых токенах, кнопка настроек с янтарным ховером, backdrop-blur сохранён.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/+layout.svelte
git commit -m "style(web): warm topbar and amber brand mark"
```

---

### Task 7: Главная (Содержание) - типографика

**Files:**
- Modify: `apps/web/src/routes/+page.svelte`

- [ ] **Step 1: Привязать размеры к тип-шкале и согреть карточки**

В `<style>` файла `apps/web/src/routes/+page.svelte`:

1. `.sec__title` - заменить `font-size: 1.05rem;` на `font-size: var(--fs-h3);` и заменить `border-bottom: 1px solid var(--border);` на `border-bottom: 2px solid var(--accent-soft);`.

2. `.resume` - заменить `background: var(--bg-soft);` на `background: var(--card);` и `border-radius: 8px;` на `border-radius: var(--radius);`; добавить `box-shadow: var(--shadow-sm);`.

3. `.pitem__id` - добавить `color: var(--accent-medium);` (заменив текущее `color: var(--fg-muted);`) чтобы номер перикопы был янтарным.

4. `.filter` - заменить `border-radius: 8px;` на `border-radius: var(--radius);` и `background: var(--bg);` на `background: var(--card);`.

- [ ] **Step 2: Проверка сборки + визуал**

Run: `pnpm --filter web build`
Затем `pnpm --filter web dev`: оглавление - книжные заголовки секций (Alegreya), номера перикоп янтарные, карточка "Продолжить чтение" приподнята тенью.
Expected: проходит, выглядит тепло и читаемо.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/+page.svelte
git commit -m "style(web): contents page typography and warm cards"
```

---

### Task 8: Режим чтения (/read/[g]) - маркеры и переключатель

**Files:**
- Modify: `apps/web/src/routes/read/[g]/+page.svelte`

- [ ] **Step 1: Привести стили к шкале и акценту**

В `<style>` файла `apps/web/src/routes/read/[g]/+page.svelte`:

1. `.switch a` - заменить `border-radius: 6px;` на `border-radius: var(--radius-sm);`; заменить `background` отсутствует - добавить `background: var(--card);`.

2. `.switch a.active` - заменить `background: var(--accent-soft);` оставить, но добавить `font-weight: var(--fw-semibold);`.

3. `.pmark` - заменить `font-size: 0.95rem;` на `font-size: var(--fs-h3);`; оставить `color: var(--accent);`; добавить `font-family: var(--font-serif);`.

4. `.chapter` - заменить `font-size: 0.85rem;` на `font-size: var(--fs-caption);`; добавить `text-transform: uppercase; letter-spacing: 0.06em;`.

5. `.vnum` - заменить `color: var(--fg-muted);` на `color: var(--accent-subtle);`.

- [ ] **Step 2: Проверка сборки + визуал**

Run: `pnpm --filter web build`
Затем `pnpm --filter web dev` на /read/lk: текст евангелия выбранным шрифтом с интерлиньяжем 1.85; маркеры перикоп янтарные книжные; номера стихов золотистые; переключатель евангелий тёплый.
Expected: проходит.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/routes/read/[g]/+page.svelte"
git commit -m "style(web): reading view markers and verse numbers"
```

---

### Task 9: Перикопа (/p/[id]) и колонки синопсиса - типографика

**Files:**
- Modify: `apps/web/src/routes/p/[id]/+page.svelte`
- Modify: `apps/web/src/lib/components/PericopeColumns.svelte`

- [ ] **Step 1: Заголовок перикопы под шкалу**

В `<style>` файла `apps/web/src/routes/p/[id]/+page.svelte`:

1. `.phead h1` - заменить `font-size: 1.4rem;` на `font-size: var(--fs-h1);`.
2. `.headnote` - заменить `background: var(--bg-soft);` на `background: var(--card);`; заменить `border-radius: 6px;` на `border-radius: var(--radius-sm);`; добавить `border: 1px solid var(--border);`.
3. `.vnum` - заменить `color: var(--fg-muted);` на `color: var(--accent-subtle);`.

- [ ] **Step 2: Заголовки колонок синопсиса**

В `<style>` файла `apps/web/src/lib/components/PericopeColumns.svelte`:

1. `.col__head` - заменить `border-bottom: 2px solid var(--border);` на `border-bottom: 2px solid var(--accent-soft);`; добавить `font-family: var(--font-serif); color: var(--accent);`.
2. `.chapter` - заменить `font-size: 0.8em;` на `font-size: var(--fs-caption);`; добавить `text-transform: uppercase; letter-spacing: 0.06em;`.

- [ ] **Step 3: Проверка сборки + визуал**

Run: `pnpm --filter web build`
Затем `pnpm --filter web dev` на любой /p/<id>: заголовки колонок янтарные с книжным шрифтом и янтарной линией; подсветка параллельных строк (--highlight) тёплая; мобильные табы (узкое окно) в новом стиле.
Expected: проходит; навести на стих - параллели подсвечиваются персиково.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/routes/p/[id]/+page.svelte" apps/web/src/lib/components/PericopeColumns.svelte
git commit -m "style(web): pericope header and synopsis column headings"
```

---

### Task 10: Второстепенные экраны и компоненты - проверка и шлифовка

**Files:**
- Modify: `apps/web/src/routes/prefaces/+page.svelte`
- Verify: `apps/web/src/routes/{bookmarks,footnotes,appendix,search}/+page.svelte`
- Verify: `apps/web/src/lib/components/{GospelPresence,ColumnTabs,RefLinkBadge,VerseItem,NoteItem,Breadcrumbs,Pager,BookmarkButton,ScrollTable,SearchBox}.svelte`

- [ ] **Step 1: prefaces - подзаголовок под шкалу**

В `<style>` файла `apps/web/src/routes/prefaces/+page.svelte` заменить локальный `font-size: 1.1rem;` (подзаголовок) на `font-size: var(--fs-h3);`.

- [ ] **Step 2: Визуальная проверка перекраски токенами (обе темы)**

Run: `pnpm --filter web dev`
Пройти по: /bookmarks, /footnotes, /appendix, /search, /prefaces в light и dark.
Проверить: GospelPresence (бейджи присутствия) янтарные; RefLinkBadge ховер янтарный; ScrollTable (если есть на /appendix) с тёплыми границами; Pager/BookmarkButton/ColumnTabs/SearchBox - тёплые токены, без синего.
Expected: все экраны в тёплой палитре, ничего не выпало.

- [ ] **Step 3: Точечная правка при находках**

Если на каком-то элементе найден жёсткий не-токеновый цвет или несоответствие - заменить на ближайший токен (фон поверхностей: var(--card); приглушённый текст: var(--fg-muted); границы: var(--border); акцент: var(--accent)). Кнопочные фоны `background: var(--bg)` в Pager/BookmarkButton/ColumnTabs можно поднять на `var(--card)` для книжной приподнятости.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/prefaces/+page.svelte
git commit -m "style(web): secondary screens typography pass"
```

(Если на Step 3 были правки компонентов - добавить их файлы в этот же commit.)

---

### Task 11: Финальная проверка

**Files:** нет правок (только проверки), кроме фиксов при провале.

- [ ] **Step 1: Полный прогон тестов**

Run: `pnpm --filter web test`
Expected: все vitest-тесты зелёные (включая fonts.test.ts и settings.svelte.test.ts).

- [ ] **Step 2: Типы и сборка**

Run: `pnpm --filter web typecheck && pnpm --filter web build`
Expected: зелёно; prerender всех маршрутов без ошибок.

- [ ] **Step 3: e2e (если сконфигурировано)**

Run: `pnpm --filter web test:e2e`
Expected: проходят, либо (если тесты завязаны на старую модель тем/засечек) - обновить селекторы под две темы и селектор шрифта, затем повторить.

- [ ] **Step 4: Финальный визуальный аудит**

Run: `pnpm --filter web dev`
Проверить в обеих темах: главная, /read/lk, один /p/<id>, drawer. Проверить prefers-reduced-motion (DevTools emulate) - анимации отключаются. Проверить переключение шрифта чтения и сохранение после перезагрузки.
Expected: цельный тёплый книжный вид, всё читаемо, акценты янтарные.

- [ ] **Step 5: Commit при необходимости**

Если на шагах 1-4 были фиксы:

```bash
git add -A
git commit -m "test(web): align tests with warm-bookish design system"
```

---

## Self-Review

Покрытие spec:
- Токены обеих тем: Task 4. Тип-шкала: Task 4. Импорт шрифтов self-host: Task 1 (deps) + Task 4 (import). Шрифт чтения (--reading-font, выбор, дефолт): Task 1, 2, 5. Стор (light|dark, без serif, миграция): Task 2. Пре-гидрация: Task 3. Drawer: Task 5. Экраны (шапка, главная, чтение, перикопа/колонки, второстепенные): Tasks 6-10. Удаление sepia/serif: Tasks 2, 3, 4, 5. Проверка (build/typecheck/test/визуал/reduced-motion/e2e): Task 11 (+ пошаговые проверки в каждой task).
- Вне области (контент, парсер, маршрутизация) - не затрагивается. Подтверждено.

Плейсхолдеры: отсутствуют - каждый шаг содержит конкретный код или конкретную команду с ожидаемым результатом.

Согласованность типов: `ReadingFontKey`, `readingFontValue`, `isReadingFontKey`, `READING_FONT_OPTIONS`, `DEFAULT_READING_FONT_KEY` определены в Task 1 и используются в Task 2 и Task 5 в тех же именах. `type Theme = 'light' | 'dark'` определён в Task 2 и потребляется в Task 5. localStorage-ключ `synopsis:settings` единообразен в Task 2, 3 и тестах.
