# Plan 2B — Reader, Search, Static Pages, Bookmarks, Settings Drawer, E2E

> **For agentic workers:** Executed inline on `master`. Steps use checkbox (`- [ ]`) syntax. Builds on Plan 2A (scaffold, data layer, stores, contents + pericope pages). Resolved versions in use: SvelteKit 2.65, Svelte 5.56, Vite 6.4, Vitest 3.2, adapter-static 3.0.

**Goal:** Complete the reader to full spec parity: full-text + reference **search**, continuous single-gospel **reading** (`/read/[g]`), **prefaces / footnotes / appendix** (chronology with horizontal scroll container), **bookmarks** + continue-reading, an accessible **settings drawer** (theme / font / serif / parallels), plus **component tests** and **Playwright e2e** covering the acceptance scenarios.

**Architecture:** Two new pure modules — `search.ts` (normalized inverted index + reference dispatch) and `reading.ts` (deduplicated single-gospel stream) — unit-tested in the node Vitest project. New routes are prerendered (`/read/[g]` via `entries()`); search builds its index lazily on the client. The settings drawer is a real modal (scrim + panel layered correctly, focus-trap, `Esc`, restore focus). Component tests run in **jsdom via `@testing-library/svelte`** (mocking `$app/*` where needed — no browser download); **Playwright** drives the real acceptance flows.

**Tech Stack additions:** `@testing-library/svelte`, `@testing-library/jest-dom`, `jsdom` (component tests); `@playwright/test` (e2e).

---

## File Structure (added/changed in this plan)

```
apps/web/
├─ package.json                       # + test deps, test:e2e script, vitest jsdom env note
├─ playwright.config.ts               # e2e config (builds + previews static output)
├─ vitest.setup.ts                    # jest-dom matchers for jsdom component tests
├─ e2e/
│  └─ acceptance.spec.ts              # Playwright acceptance scenarios
├─ src/lib/
│  ├─ data/
│  │  ├─ search.ts                    # buildSearchIndex + search (pure)
│  │  ├─ search.test.ts
│  │  ├─ reading.ts                   # buildReading (pure, deduped)
│  │  └─ reading.test.ts
│  └─ components/
│     ├─ ScrollTable.svelte           # overflow-x container for the chronology table
│     ├─ SettingsDrawer.svelte        # modal drawer, focus-trap
│     ├─ SettingsDrawer.svelte.test.ts
│     ├─ PericopeColumns.svelte.test.ts  # (deferred from 2A) verse vs note
│     ├─ SearchBox.svelte             # header search field -> navigates to /search?q=
│     └─ BookmarkButton.svelte
└─ src/routes/
   ├─ +layout.svelte                  # CHANGED: header (search, settings btn, nav), drawer mount
   ├─ +page.svelte                    # CHANGED: continue-reading banner
   ├─ search/+page.ts +page.svelte
   ├─ read/[g]/+page.ts +page.svelte
   ├─ prefaces/+page.ts +page.svelte
   ├─ footnotes/+page.ts +page.svelte
   ├─ appendix/+page.ts +page.svelte
   ├─ bookmarks/+page.svelte
   └─ p/[id]/+page.svelte             # CHANGED: bookmark button in header
```

---

### Task 1: `search.ts` — normalized index + reference dispatch (TDD)

**Files:** Create `src/lib/data/search.ts`, `src/lib/data/search.test.ts`

- [ ] **Step 1: Write the failing test** (uses real data + the model)

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from './synopsis.js';
import { buildSearchIndex, search } from './search.js';

const raw = JSON.parse(
  readFileSync(new URL('../../../../../data/synopsis.json', import.meta.url), 'utf8')
);
const model = buildModel(raw);
const index = buildSearchIndex(model);

describe('search', () => {
  it('full-text "Агнец Божий" finds Иоанн 1:29 and 1:36', () => {
    const res = search(index, model, 'Агнец Божий');
    expect(res.kind).toBe('text');
    if (res.kind !== 'text') return;
    const hits = res.hits.filter((h) => h.gospel === 'jn' && h.chapter === 1);
    const verses = hits.map((h) => h.verse).sort((a, b) => a - b);
    expect(verses).toContain(29);
    expect(verses).toContain(36);
  });

  it('normalizes ё/е and case', () => {
    const res = search(index, model, 'агнец божiй'.replace('i', 'и'));
    expect(res.kind).toBe('text');
  });

  it('reference query "Мф 5:3" dispatches to a reference result for pericope 51.1', () => {
    const res = search(index, model, 'Мф 5:3');
    expect(res.kind).toBe('reference');
    if (res.kind !== 'reference') return;
    expect(res.pericopeId).toBe('51.1');
    expect(res.anchor).toBe('mt-5-3');
  });

  it('reference query "Мф 3:13" dispatches to pericope 21', () => {
    const res = search(index, model, 'Мф 3:13');
    expect(res.kind).toBe('reference');
    if (res.kind !== 'reference') return;
    expect(res.pericopeId).toBe('21');
  });

  it('returns empty text results for gibberish', () => {
    const res = search(index, model, 'zzzqqq');
    expect(res.kind).toBe('text');
    if (res.kind !== 'text') return;
    expect(res.hits.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run src/lib/data/search.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/data/search.ts`**

```ts
import { isVerse, type GospelKey } from '@synopsis/schema';
import type { SynopsisModel } from './synopsis.js';
import { parseRef } from './refs.js';

export interface VerseRecord {
  pid: string;
  gospel: GospelKey;
  chapter: number;
  verse: number;
  suf: string;
  text: string;
}

export interface SearchIndex {
  records: VerseRecord[];
  /** token -> sorted unique record indices */
  postings: Map<string, number[]>;
}

const GOSPEL_KEYS = ['mt', 'mk', 'lk', 'jn'] as const;

/** Lowercase, ё->е, drop everything but cyrillic/latin/digits, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

export function buildSearchIndex(model: SynopsisModel): SearchIndex {
  const records: VerseRecord[] = [];
  for (const p of model.raw.pericopes) {
    for (const g of GOSPEL_KEYS) {
      const col = p.columns[g];
      if (!col) continue;
      for (const seg of col.segments) {
        for (const item of seg.items) {
          if (!isVerse(item)) continue;
          records.push({
            pid: p.id,
            gospel: g,
            chapter: seg.chapter,
            verse: item.v,
            suf: item.suf,
            text: item.t
          });
        }
      }
    }
  }

  const postings = new Map<string, number[]>();
  records.forEach((rec, i) => {
    const seen = new Set<string>();
    for (const tok of tokenize(rec.text)) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      const arr = postings.get(tok);
      if (arr) arr.push(i);
      else postings.set(tok, [i]);
    }
  });

  return { records, postings };
}

export interface ReferenceResult {
  kind: 'reference';
  pericopeId: string;
  anchor: string;
  gospel: GospelKey;
}
export interface TextResult {
  kind: 'text';
  hits: VerseRecord[];
}
export type SearchResult = ReferenceResult | TextResult;

const MAX_HITS = 100;

export function search(index: SearchIndex, model: SynopsisModel, query: string): SearchResult {
  const trimmed = query.trim();
  if (!trimmed) return { kind: 'text', hits: [] };

  // 1) reference dispatch
  const ref = parseRef(trimmed);
  if (ref) {
    const resolved = model.resolveRef(ref);
    if (resolved) {
      const anchor =
        ref.verse !== undefined ? `${ref.gospel}-${ref.chapter}-${ref.verse}` : `${ref.gospel}-${ref.chapter}`;
      return { kind: 'reference', pericopeId: resolved.id, anchor, gospel: ref.gospel };
    }
  }

  // 2) full-text: AND of token postings, fallback to substring scan
  const tokens = normalize(trimmed).split(' ').filter(Boolean);
  if (!tokens.length) return { kind: 'text', hits: [] };

  let candidate: number[] | null = null;
  for (const tok of tokens) {
    const posting = index.postings.get(tok);
    if (!posting) {
      candidate = [];
      break;
    }
    candidate = candidate === null ? posting.slice() : intersect(candidate, posting);
    if (candidate.length === 0) break;
  }

  let hitIdx = candidate ?? [];
  if (hitIdx.length === 0) {
    // substring fallback over normalized text (handles partial words)
    const needle = normalize(trimmed);
    hitIdx = [];
    for (let i = 0; i < index.records.length && hitIdx.length < MAX_HITS; i++) {
      if (normalize(index.records[i]!.text).includes(needle)) hitIdx.push(i);
    }
  }

  return { kind: 'text', hits: hitIdx.slice(0, MAX_HITS).map((i) => index.records[i]!) };
}

function intersect(a: number[], b: number[]): number[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run src/lib/data/search.test.ts`
Expected: PASS. If "Агнец Божий" does not surface jn 1:36, inspect which pericope holds jn 1:36 in columns (search records every verse occurrence) — do not edit data.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data/search.ts apps/web/src/lib/data/search.test.ts
git commit -m "feat(web): client search index with full-text and reference dispatch"
```

---

### Task 2: `reading.ts` — deduplicated single-gospel stream (TDD)

**Files:** Create `src/lib/data/reading.ts`, `src/lib/data/reading.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from './synopsis.js';
import { buildReading } from './reading.js';

const raw = JSON.parse(
  readFileSync(new URL('../../../../../data/synopsis.json', import.meta.url), 'utf8')
);
const model = buildModel(raw);

describe('buildReading', () => {
  it('produces ordered blocks for Лука with pericope markers and verses', () => {
    const blocks = buildReading(model, 'lk');
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((b) => b.kind === 'pericope')).toBe(true);
    expect(blocks.some((b) => b.kind === 'verse')).toBe(true);
  });

  it('deduplicates repeated verses (each gospel-chapter-verse appears once)', () => {
    const blocks = buildReading(model, 'lk');
    const seen = new Set<string>();
    let dup = 0;
    for (const b of blocks) {
      if (b.kind !== 'verse') continue;
      const key = `${b.chapter}-${b.verse}-${b.suf}`;
      if (seen.has(key)) dup++;
      seen.add(key);
    }
    expect(dup).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run src/lib/data/reading.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/data/reading.ts`**

```ts
import { isVerse, type GospelKey } from '@synopsis/schema';
import type { SynopsisModel } from './synopsis.js';

export type ReadingBlock =
  | { kind: 'pericope'; id: string; title: string }
  | { kind: 'chapter'; chapter: number }
  | { kind: 'verse'; chapter: number; verse: number; suf: string; text: string };

/**
 * Flatten a single gospel into a continuous reading stream in pericope order.
 * Inserts a pericope marker when entering a new pericope and a chapter marker
 * when the chapter changes. Repeated verses (same chapter:verse:suf) are shown once.
 */
export function buildReading(model: SynopsisModel, gospel: GospelKey): ReadingBlock[] {
  const blocks: ReadingBlock[] = [];
  const seen = new Set<string>();
  let lastChapter: number | null = null;

  for (const p of model.raw.pericopes) {
    const col = p.columns[gospel];
    if (!col) continue;
    let emittedMarker = false;

    for (const seg of col.segments) {
      for (const item of seg.items) {
        if (!isVerse(item)) continue;
        const key = `${seg.chapter}-${item.v}-${item.suf}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (!emittedMarker) {
          blocks.push({ kind: 'pericope', id: p.id, title: p.title });
          emittedMarker = true;
          lastChapter = null; // force a chapter marker after a pericope marker
        }
        if (seg.chapter !== lastChapter) {
          blocks.push({ kind: 'chapter', chapter: seg.chapter });
          lastChapter = seg.chapter;
        }
        blocks.push({
          kind: 'verse',
          chapter: seg.chapter,
          verse: item.v,
          suf: item.suf,
          text: item.t
        });
      }
    }
  }
  return blocks;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run src/lib/data/reading.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data/reading.ts apps/web/src/lib/data/reading.test.ts
git commit -m "feat(web): buildReading deduplicated single-gospel stream"
```

---

### Task 3: `ScrollTable.svelte` — horizontal scroll container

**Files:** Create `src/lib/components/ScrollTable.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  let { columns, rows }: { columns: string[]; rows: string[][] } = $props();
</script>

<div class="scroll" role="region" aria-label="Таблица" tabindex="0">
  <table>
    <thead>
      <tr>
        {#each columns as c, i (i)}<th>{c}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as row, ri (ri)}
        <tr>
          {#each row as cell, ci (ci)}<td>{cell}</td>{/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroll {
    overflow-x: auto;
    max-width: 100%;
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  table {
    border-collapse: collapse;
    min-width: 100%;
    font-size: 0.9em;
  }
  th,
  td {
    border: 1px solid var(--border);
    padding: 0.35rem 0.6rem;
    text-align: left;
    white-space: nowrap;
    vertical-align: top;
  }
  th {
    background: var(--bg-soft);
    position: sticky;
    top: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/components/ScrollTable.svelte
git commit -m "feat(web): ScrollTable horizontal-scroll container for chronology"
```

---

### Task 4: `SettingsDrawer.svelte` — accessible modal drawer

The old version's bug: the scrim sat above the panel and ate clicks. Here the scrim and panel are siblings; the panel is painted after (and above) the scrim, clicks on the panel never reach the scrim, and `Esc` + a focus-trap + focus restore are implemented.

**Files:** Create `src/lib/components/SettingsDrawer.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import { settings, type Theme, type FontSize } from '$lib/stores/settings.svelte.js';

  let { open = $bindable() }: { open: boolean } = $props();

  let panel = $state<HTMLDivElement | null>(null);
  let lastFocused: HTMLElement | null = null;

  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Светлая' },
    { value: 'sepia', label: 'Сепия' },
    { value: 'dark', label: 'Тёмная' }
  ];
  const sizes: { value: FontSize; label: string }[] = [
    { value: 'sm', label: 'A−' },
    { value: 'md', label: 'A' },
    { value: 'lg', label: 'A+' }
  ];

  function close() {
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab' && panel) {
      const focusables = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  $effect(() => {
    if (open) {
      lastFocused = document.activeElement as HTMLElement | null;
      queueMicrotask(() => panel?.querySelector<HTMLElement>('button')?.focus());
    } else {
      lastFocused?.focus?.();
    }
  });
</script>

{#if open}
  <div class="scrim" onclick={close} aria-hidden="true"></div>
  <div
    class="panel"
    role="dialog"
    aria-modal="true"
    aria-label="Настройки"
    tabindex="-1"
    bind:this={panel}
    onkeydown={onKeydown}
  >
    <div class="panel__head">
      <h2>Настройки</h2>
      <button class="x" onclick={close} aria-label="Закрыть">✕</button>
    </div>

    <fieldset>
      <legend>Тема</legend>
      <div class="row">
        {#each themes as t (t.value)}
          <button
            class:active={settings.theme === t.value}
            aria-pressed={settings.theme === t.value}
            onclick={() => settings.setTheme(t.value)}>{t.label}</button
          >
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Размер шрифта</legend>
      <div class="row">
        {#each sizes as s (s.value)}
          <button
            class:active={settings.fontSize === s.value}
            aria-pressed={settings.fontSize === s.value}
            onclick={() => settings.setFontSize(s.value)}>{s.label}</button
          >
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend>Текст</legend>
      <label class="check">
        <input
          type="checkbox"
          checked={settings.serif}
          onchange={(e) => settings.setSerif(e.currentTarget.checked)}
        />
        С засечками
      </label>
    </fieldset>

    <fieldset>
      <legend>Параллели</legend>
      <label class="check">
        <input
          type="checkbox"
          checked={settings.highlightParallels}
          onchange={(e) => settings.setHighlightParallels(e.currentTarget.checked)}
        />
        Подсвечивать параллельные стихи
      </label>
    </fieldset>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
  }
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(360px, 90vw);
    background: var(--bg);
    border-left: 1px solid var(--border);
    z-index: 101;
    padding: 1rem;
    overflow-y: auto;
  }
  .panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .panel__head h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .x {
    border: none;
    background: none;
    font-size: 1.1rem;
    cursor: pointer;
    color: var(--fg);
  }
  fieldset {
    border: 1px solid var(--border);
    border-radius: 6px;
    margin: 0.75rem 0;
  }
  legend {
    color: var(--fg-muted);
    font-size: 0.85em;
    padding: 0 0.4rem;
  }
  .row {
    display: flex;
    gap: 0.4rem;
  }
  .row button {
    flex: 1;
    padding: 0.4rem;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
  }
  .row button.active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  .check {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    cursor: pointer;
  }
</style>
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter web typecheck` → 0 errors.

```bash
git add apps/web/src/lib/components/SettingsDrawer.svelte
git commit -m "feat(web): accessible settings drawer (focus-trap, Esc, layered scrim)"
```

---

### Task 5: `SearchBox.svelte` + `BookmarkButton.svelte`

**Files:** Create `src/lib/components/SearchBox.svelte`, `src/lib/components/BookmarkButton.svelte`

- [ ] **Step 1: `SearchBox.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  let value = $state('');
  function submit(e: Event) {
    e.preventDefault();
    const q = value.trim();
    if (q) goto(`${base}/search?q=${encodeURIComponent(q)}`);
  }
</script>

<form class="searchbox" onsubmit={submit} role="search">
  <input
    name="q"
    type="search"
    placeholder="Поиск: текст или «Мф 5:3»"
    bind:value
    aria-label="Поиск"
  />
</form>

<style>
  .searchbox {
    flex: 1;
    max-width: 360px;
  }
  .searchbox input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }
</style>
```

- [ ] **Step 2: `BookmarkButton.svelte`**

```svelte
<script lang="ts">
  import { bookmarks } from '$lib/stores/bookmarks.svelte.js';
  let { id }: { id: string } = $props();
  const active = $derived(bookmarks.has(id));
</script>

<button
  class="bm"
  class:active
  aria-pressed={active}
  onclick={() => bookmarks.toggle(id)}
  title={active ? 'Убрать из закладок' : 'В закладки'}
>
  {active ? '★' : '☆'} Закладка
</button>

<style>
  .bm {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg-muted);
    border-radius: 6px;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.85em;
  }
  .bm.active {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/components/SearchBox.svelte apps/web/src/lib/components/BookmarkButton.svelte
git commit -m "feat(web): SearchBox (header) and BookmarkButton components"
```

---

### Task 6: Header + drawer wiring in `+layout.svelte`

**Files:** Modify `src/routes/+layout.svelte`

- [ ] **Step 1: Replace `+layout.svelte`** with the version that adds the search box, nav links, settings button, and mounts the drawer.

```svelte
<script lang="ts">
  import '../app.css';
  import { base } from '$app/paths';
  import { settings } from '$lib/stores/settings.svelte.js';
  import SearchBox from '$lib/components/SearchBox.svelte';
  import SettingsDrawer from '$lib/components/SettingsDrawer.svelte';

  let { children } = $props();
  let settingsOpen = $state(false);

  $effect(() => {
    settings.apply();
  });
</script>

<a class="skip-link" href="#main">К содержанию</a>

<header class="topbar">
  <nav class="topbar__inner">
    <a class="brand" href="{base}/">Синопсис</a>
    <SearchBox />
    <div class="links">
      <a href="{base}/read/lk">Читать</a>
      <a href="{base}/bookmarks">Закладки</a>
      <a href="{base}/prefaces">Предисловия</a>
      <a href="{base}/footnotes">Примечания</a>
      <a href="{base}/appendix">Хронология</a>
    </div>
    <button class="gear" onclick={() => (settingsOpen = true)} aria-label="Настройки">⚙</button>
  </nav>
</header>

<main id="main" class="container">
  {@render children()}
</main>

<SettingsDrawer bind:open={settingsOpen} />

<style>
  .topbar {
    border-bottom: 1px solid var(--border);
    background: var(--bg-soft);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .topbar__inner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0.6rem 1rem;
    flex-wrap: wrap;
  }
  .brand {
    font-weight: 600;
    color: var(--fg);
  }
  .links {
    display: flex;
    gap: 0.75rem;
    font-size: 0.9em;
  }
  .gear {
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    padding: 0.3rem 0.55rem;
    cursor: pointer;
    font-size: 1rem;
  }
  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem;
  }
  .skip-link {
    position: absolute;
    left: -9999px;
  }
  .skip-link:focus {
    left: 1rem;
    top: 0.5rem;
    z-index: 200;
    background: var(--bg);
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
  }

  @media (max-width: 760px) {
    .links {
      order: 3;
      width: 100%;
      overflow-x: auto;
    }
  }
</style>
```

- [ ] **Step 2: Typecheck and commit**

Run: `pnpm --filter web typecheck` → 0 errors.

```bash
git add apps/web/src/routes/+layout.svelte
git commit -m "feat(web): header with search, nav links, and settings drawer"
```

---

### Task 7: `/search` route

Builds the index lazily on the client; reads `?q=` from the URL; on a reference result, auto-navigates to the target pericope anchor.

**Files:** Create `src/routes/search/+page.ts`, `src/routes/search/+page.svelte`

- [ ] **Step 1: `src/routes/search/+page.ts`**

```ts
export const prerender = true;
```

- [ ] **Step 2: `src/routes/search/+page.svelte`**

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { GOSPEL_LABELS } from '$lib/data/labels.js';
  import { loadSynopsis, type SynopsisModel } from '$lib/data/synopsis.js';
  import { buildSearchIndex, search, type SearchIndex, type SearchResult } from '$lib/data/search.js';

  let model = $state<SynopsisModel | null>(null);
  let index = $state<SearchIndex | null>(null);
  let query = $state('');

  // initialize query from ?q=
  $effect(() => {
    query = page.url.searchParams.get('q') ?? '';
  });

  $effect(() => {
    if (!browser || model) return;
    loadSynopsis(fetch).then((m) => {
      model = m;
      index = buildSearchIndex(m);
    });
  });

  const result = $derived<SearchResult | null>(
    model && index && query.trim() ? search(index, model, query) : null
  );

  // a reference query jumps straight to the pericope anchor
  $effect(() => {
    if (result && result.kind === 'reference') {
      goto(`${base}/p/${result.pericopeId}#${result.anchor}`);
    }
  });
</script>

<svelte:head><title>Поиск</title></svelte:head>

<h1>Поиск</h1>
<input
  class="q"
  type="search"
  name="q"
  bind:value={query}
  placeholder="Текст или ссылка, напр. «Мф 5:3»"
  aria-label="Поисковый запрос"
/>

{#if !model}
  <p class="muted">Индекс загружается…</p>
{:else if result && result.kind === 'text'}
  <p class="muted">{result.hits.length} совпадений</p>
  <ul class="hits">
    {#each result.hits as h (h.pid + h.gospel + h.chapter + h.verse + h.suf)}
      <li>
        <a href="{base}/p/{h.pid}#{h.gospel}-{h.chapter}-{h.verse}">
          <b>{GOSPEL_LABELS[h.gospel].abbr} {h.chapter}:{h.verse}{h.suf}</b>
          <span class="snippet">{h.text}</span>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .q {
    width: 100%;
    padding: 0.6rem 0.8rem;
    margin: 0.5rem 0 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }
  .muted {
    color: var(--fg-muted);
  }
  .hits {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .hits li {
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 0;
  }
  .snippet {
    color: var(--fg);
    margin-left: 0.5rem;
  }
</style>
```

- [ ] **Step 3: Typecheck, commit**

Run: `pnpm --filter web typecheck` → 0 errors.

```bash
git add apps/web/src/routes/search/+page.ts apps/web/src/routes/search/+page.svelte
git commit -m "feat(web): search page (client index, full-text + reference jump)"
```

---

### Task 8: `/read/[g]` route

**Files:** Create `src/routes/read/[g]/+page.ts`, `src/routes/read/[g]/+page.svelte`

- [ ] **Step 1: `src/routes/read/[g]/+page.ts`**

```ts
import { error } from '@sveltejs/kit';
import { GOSPELS, type GospelKey } from '$lib/data/labels.js';
import { loadSynopsis } from '$lib/data/synopsis.js';
import { buildReading } from '$lib/data/reading.js';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => GOSPELS.map((g) => ({ g }));

export const load: PageLoad = async ({ params, fetch }) => {
  const g = params.g as GospelKey;
  if (!GOSPELS.includes(g)) throw error(404, `Неизвестное Евангелие ${params.g}`);
  const model = await loadSynopsis(fetch);
  return { gospel: g, blocks: buildReading(model, g) };
};
```

- [ ] **Step 2: `src/routes/read/[g]/+page.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import { GOSPELS, GOSPEL_LABELS, gospelHeading } from '$lib/data/labels.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{gospelHeading(data.gospel)}</title></svelte:head>

<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>{gospelHeading(data.gospel)}</b></nav>

<div class="switch">
  {#each GOSPELS as g (g)}
    <a href="{base}/read/{g}" class:active={g === data.gospel}>{GOSPEL_LABELS[g].nom}</a>
  {/each}
</div>

<article class="reader verse-text">
  {#each data.blocks as b, i (i)}
    {#if b.kind === 'pericope'}
      <h2 class="pmark"><a href="{base}/p/{b.id}">п. {b.id}. {b.title}</a></h2>
    {:else if b.kind === 'chapter'}
      <h3 class="chapter">Глава {b.chapter}</h3>
    {:else}
      <span class="verse"><sup class="vnum">{b.verse}{b.suf}</sup> {b.text}</span>{' '}
    {/if}
  {/each}
</article>

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .switch {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .switch a {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.3rem 0.7rem;
    color: var(--fg);
  }
  .switch a.active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  .pmark {
    font-size: 0.95rem;
    margin: 1.25rem 0 0.25rem;
    color: var(--accent);
  }
  .chapter {
    font-size: 0.85rem;
    color: var(--fg-muted);
    margin: 0.75rem 0 0.25rem;
  }
  .vnum {
    color: var(--fg-muted);
    font-weight: 600;
  }
</style>
```

- [ ] **Step 3: Typecheck, commit**

Run: `pnpm --filter web typecheck` → 0 errors.

```bash
git add apps/web/src/routes/read/[g]/+page.ts apps/web/src/routes/read/[g]/+page.svelte
git commit -m "feat(web): single-gospel reader with chapter/pericope markers"
```

---

### Task 9: `/prefaces`, `/footnotes`, `/appendix`

**Files:** Create `+page.ts` + `+page.svelte` under `src/routes/prefaces/`, `src/routes/footnotes/`, `src/routes/appendix/`

- [ ] **Step 1: Prefaces loader `src/routes/prefaces/+page.ts`**

```ts
import { loadSynopsis } from '$lib/data/synopsis.js';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const model = await loadSynopsis(fetch);
  return { prefaces: model.raw.prefaces };
};
```

- [ ] **Step 2: `src/routes/prefaces/+page.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Предисловия</title></svelte:head>
<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>Предисловия</b></nav>

<div class="prose">
  {#each data.prefaces as pref, i (i)}
    <section>
      <h2>{pref.title}</h2>
      {#each pref.paragraphs as para, j (j)}<p>{para}</p>{/each}
    </section>
  {/each}
  {#if data.prefaces.length === 0}<p class="muted">Предисловия не извлечены.</p>{/if}
</div>

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .prose {
    max-width: 70ch;
  }
  .prose h2 {
    font-size: 1.1rem;
  }
  .muted {
    color: var(--fg-muted);
  }
</style>
```

- [ ] **Step 3: Footnotes loader `src/routes/footnotes/+page.ts`**

```ts
import { loadSynopsis } from '$lib/data/synopsis.js';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const model = await loadSynopsis(fetch);
  return { footnotes: model.raw.footnotes };
};
```

- [ ] **Step 4: `src/routes/footnotes/+page.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Примечания</title></svelte:head>
<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>Примечания</b></nav>

<div class="prose">
  <h1>Примечания</h1>
  {#each data.footnotes as f (f.n)}<p><b>{f.n}.</b> {f.text}</p>{/each}
  {#if data.footnotes.length === 0}<p class="muted">Примечания не извлечены.</p>{/if}
</div>

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .prose {
    max-width: 70ch;
  }
  .muted {
    color: var(--fg-muted);
  }
</style>
```

- [ ] **Step 5: Appendix loader `src/routes/appendix/+page.ts`**

```ts
import { loadSynopsis } from '$lib/data/synopsis.js';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const model = await loadSynopsis(fetch);
  return { appendix: model.raw.appendix2 };
};
```

- [ ] **Step 6: `src/routes/appendix/+page.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import ScrollTable from '$lib/components/ScrollTable.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.appendix.title}</title></svelte:head>
<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>Хронология</b></nav>

<h1>{data.appendix.title}</h1>
{#each data.appendix.intro as para, i (i)}<p class="intro">{para}</p>{/each}

<ScrollTable columns={data.appendix.columns} rows={data.appendix.rows} />

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .intro {
    max-width: 70ch;
    color: var(--fg-muted);
  }
</style>
```

- [ ] **Step 7: Typecheck, commit**

Run: `pnpm --filter web typecheck` → 0 errors.

```bash
git add apps/web/src/routes/prefaces apps/web/src/routes/footnotes apps/web/src/routes/appendix
git commit -m "feat(web): prefaces, footnotes, and chronology (scroll-contained) pages"
```

---

### Task 10: `/bookmarks` page + bookmark button + continue-reading

**Files:** Create `src/routes/bookmarks/+page.ts` + `+page.svelte`; modify `src/routes/p/[id]/+page.svelte` and `src/routes/+page.svelte`

- [ ] **Step 1: `src/routes/bookmarks/+page.ts`** (provide id→title map, plain)

```ts
import { loadSynopsis } from '$lib/data/synopsis.js';
import type { PageLoad } from './$types';

export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
  const model = await loadSynopsis(fetch);
  const titles: Record<string, string> = {};
  for (const p of model.raw.pericopes) titles[p.id] = p.title;
  return { titles };
};
```

- [ ] **Step 2: `src/routes/bookmarks/+page.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import { bookmarks } from '$lib/stores/bookmarks.svelte.js';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Закладки</title></svelte:head>
<nav class="crumbs"><a href="{base}/">Содержание</a> › <b>Закладки</b></nav>

<h1>Закладки</h1>
{#if bookmarks.ids.length === 0}
  <p class="muted">Пока нет закладок. Откройте перикопу и нажмите «Закладка».</p>
{:else}
  <ul class="list">
    {#each bookmarks.ids as id (id)}
      <li>
        <a href="{base}/p/{id}">{id}. {data.titles[id] ?? id}</a>
        <button onclick={() => bookmarks.toggle(id)} aria-label="Убрать">✕</button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .crumbs {
    font-size: 0.85em;
    color: var(--fg-muted);
    margin: 0.5rem 0 1rem;
  }
  .muted {
    color: var(--fg-muted);
  }
  .list {
    list-style: none;
    padding: 0;
  }
  .list li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--border);
  }
  .list button {
    border: none;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
  }
</style>
```

- [ ] **Step 3: Add the bookmark button to the pericope header.** In `src/routes/p/[id]/+page.svelte`, add the import and place `<BookmarkButton id={p.id} />` inside `.phead`.

Add to the script block imports:

```ts
import BookmarkButton from '$lib/components/BookmarkButton.svelte';
```

Replace the `<header class="phead">` block with:

```svelte
<header class="phead">
  <div class="phead__top">
    <h1>{p.id}. {p.title}</h1>
    <BookmarkButton id={p.id} />
  </div>
  {#if p.place}<p class="place">{p.place}</p>{/if}
  {#if p.headnote}<p class="headnote">{p.headnote}</p>{/if}
</header>
```

And add to its `<style>`:

```css
.phead__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
```

- [ ] **Step 4: Continue-reading banner on the contents page.** In `src/routes/+page.svelte`, add the import and a banner above `<h1>`.

Add to the script block:

```ts
import { reading } from '$lib/stores/reading.svelte.js';
```

Add immediately after the `<svelte:head>` line:

```svelte
{#if reading.last}
  <p class="resume">
    Продолжить чтение:
    <a href="{base}/p/{reading.last.id}">{reading.last.id}. {reading.last.title}</a>
  </p>
{/if}
```

Add to its `<style>`:

```css
.resume {
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
  margin-bottom: 1rem;
}
```

- [ ] **Step 5: Typecheck, commit**

Run: `pnpm --filter web typecheck` → 0 errors.

```bash
git add apps/web/src/routes/bookmarks "apps/web/src/routes/p/[id]/+page.svelte" apps/web/src/routes/+page.svelte
git commit -m "feat(web): bookmarks page, bookmark button, continue-reading banner"
```

---

### Task 11: Component tests (jsdom + Testing Library)

Add the deps and a jsdom setup, then test PericopeColumns (verse vs note) and SettingsDrawer (panel click does NOT close; scrim click DOES; Esc closes). `$app/*` modules are mocked.

**Files:** Modify `apps/web/package.json`, `apps/web/vite.config.ts`; create `apps/web/vitest.setup.ts`, `src/lib/components/PericopeColumns.svelte.test.ts`, `src/lib/components/SettingsDrawer.svelte.test.ts`

- [ ] **Step 1: Add dev deps**

Run (resilient flags per 2A): `pnpm --filter web add -D @testing-library/svelte @testing-library/jest-dom jsdom`
Expected: install succeeds; lockfile updates.

- [ ] **Step 2: Create `apps/web/vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Update `apps/web/vite.config.ts`** to add jsdom setup + svelte testing resolution

```ts
/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    // component tests opt into jsdom via a per-file `// @vitest-environment jsdom` docblock
    server: { deps: { inline: ['@testing-library/svelte'] } }
  }
});
```

- [ ] **Step 4: `src/lib/components/PericopeColumns.svelte.test.ts`**

```ts
// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import PericopeColumns from './PericopeColumns.svelte';
import type { Pericope } from '@synopsis/schema';

vi.mock('$app/paths', () => ({ base: '' }));

const pericope = {
  id: 't',
  title: 'Test',
  place: null,
  pages: [],
  order: 0,
  alignment: [{ mt: '5:3', lk: '6:20' }],
  columns: {
    mt: {
      segments: [
        {
          gospel: 'mt',
          chapter: 5,
          prev: null,
          next: null,
          items: [
            { v: 3, suf: '', t: 'Блаженны нищие духом' },
            { note: 'примечание редактора' }
          ]
        }
      ]
    },
    mk: null,
    lk: {
      segments: [
        {
          gospel: 'lk',
          chapter: 6,
          prev: null,
          next: null,
          items: [{ v: 20, suf: '', t: 'Блаженны нищие' }]
        }
      ]
    },
    jn: null
  }
} as unknown as Pericope;

describe('PericopeColumns', () => {
  it('renders numbered verses and unnumbered notes', () => {
    render(PericopeColumns, { props: { pericope, present: ['mt', 'lk'] } });
    expect(screen.getByText('Блаженны нищие духом')).toBeInTheDocument();
    expect(screen.getByText('примечание редактора')).toBeInTheDocument();
    expect(screen.getAllByText('Матфей').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Лука').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: `src/lib/components/SettingsDrawer.svelte.test.ts`**

```ts
// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear()
  });
}
afterEach(() => vi.unstubAllGlobals());

import SettingsDrawer from './SettingsDrawer.svelte';

describe('SettingsDrawer', () => {
  it('clicking the panel does not close; clicking the scrim closes', async () => {
    installStorage();
    let open = $state(true);
    const props = { get open() { return open; }, set open(v: boolean) { open = v; } };
    render(SettingsDrawer, { props });

    const dialog = screen.getByRole('dialog');
    await fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).not.toBeNull(); // still open

    const scrim = document.querySelector('.scrim')!;
    await fireEvent.click(scrim);
    expect(screen.queryByRole('dialog')).toBeNull(); // closed
  });

  it('Escape closes the drawer', async () => {
    installStorage();
    let open = $state(true);
    const props = { get open() { return open; }, set open(v: boolean) { open = v; } };
    render(SettingsDrawer, { props });
    const dialog = screen.getByRole('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
```

> Implementer note: `$state` in a `.test.ts` requires the file to be processed by the Svelte plugin; if the bindable `open` proves awkward in tests, use a small wrapper component `SettingsDrawerHarness.svelte` that owns `let open = $state(true)` and renders `<SettingsDrawer bind:open />`, then assert on the harness. Prefer whichever compiles cleanly; the behavior asserted (panel-click keeps open, scrim-click/Esc close) is what matters.

- [ ] **Step 6: Run component tests**

Run: `pnpm --filter web exec vitest run src/lib/components`
Expected: PASS. If `@testing-library/svelte` cannot mount under the node default env, confirm the `// @vitest-environment jsdom` docblock is the first line of each test file.

- [ ] **Step 7: Run the whole suite and commit**

Run: `pnpm --filter web test`
Expected: all logic + component tests PASS.

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/vite.config.ts apps/web/vitest.setup.ts apps/web/src/lib/components/PericopeColumns.svelte.test.ts apps/web/src/lib/components/SettingsDrawer.svelte.test.ts
# (pnpm-lock.yaml lives at repo root)
git add pnpm-lock.yaml
git commit -m "test(web): component tests for PericopeColumns and SettingsDrawer (jsdom)"
```

---

### Task 12: Playwright e2e for acceptance scenarios

**Files:** Modify `apps/web/package.json`; create `apps/web/playwright.config.ts`, `apps/web/e2e/acceptance.spec.ts`; modify `.gitignore`, `.github/workflows/ci.yml`

- [ ] **Step 1: Add dep + script**

Run: `pnpm --filter web add -D @playwright/test`
Then add to `apps/web/package.json` scripts: `"test:e2e": "playwright test"`.
Install the browser: `pnpm --filter web exec playwright install chromium`
(If the browser download fails on the network, retry; record the blocker if it persists — the spec requires e2e, so this must ultimately pass in CI where the network is reliable.)

- [ ] **Step 2: Create `apps/web/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  use: { baseURL: 'http://localhost:4173' }
});
```

- [ ] **Step 3: Create `apps/web/e2e/acceptance.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('pericope 12 renders a single Luke column', async ({ page }) => {
  await page.goto('/p/12');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('12.');
  await expect(page.getByRole('heading', { name: 'Лука' })).toBeVisible();
});

test('pericope 21 shows Mt/Mk/Lk + John fragment with prev and next links', async ({ page }) => {
  await page.goto('/p/21');
  await expect(page.getByRole('heading', { name: 'Матфей' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Иоанн' })).toBeVisible();
  await expect(page.getByText('ранее:')).toBeVisible();
  await expect(page.getByText('далее:')).toBeVisible();
});

test('pericope 51.1 shows numbered Beatitudes in Mt 5 and Lk 6', async ({ page }) => {
  await page.goto('/p/51.1');
  await expect(page.getByText('Блаженны').first()).toBeVisible();
  await expect(page.getByText('5', { exact: true }).first()).toBeVisible();
});

test('reference search "Мф 3:13" jumps to pericope 21', async ({ page }) => {
  await page.goto('/search?q=' + encodeURIComponent('Мф 3:13'));
  await expect(page).toHaveURL(/\/p\/21#mt-3-13/);
});

test('reference search "Мф 5:3" jumps to pericope 51.1', async ({ page }) => {
  await page.goto('/search?q=' + encodeURIComponent('Мф 5:3'));
  await expect(page).toHaveURL(/\/p\/51\.1#mt-5-3/);
});

test('full-text "Агнец Божий" finds John 1:29 and 1:36', async ({ page }) => {
  await page.goto('/search?q=' + encodeURIComponent('Агнец Божий'));
  await expect(page.getByText('Ин 1:29')).toBeVisible();
  await expect(page.getByText('Ин 1:36')).toBeVisible();
});

test('at 390px the columns become tabs and the page does not overflow horizontally', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/p/21');
  await expect(page.getByRole('tab', { name: 'Матфей' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(overflow).toBe(true);
});

test('chronology table scrolls without breaking the page width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/appendix');
  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(noOverflow).toBe(true);
});

test('theme choice persists across reloads', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('settings drawer: clicking the panel keeps it open, scrim closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 10, y: 10 } });
  await expect(dialog).toBeVisible();
  await page.locator('.scrim').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeHidden();
});
```

- [ ] **Step 4: Ignore Playwright artifacts** — append to `.gitignore` (root):

```gitignore
# Playwright
apps/web/test-results/
apps/web/playwright-report/
```

- [ ] **Step 5: Run e2e**

Run: `pnpm --filter web test:e2e`
Expected: all scenarios PASS. Fix selectors against the real DOM as needed (e.g., exact heading text); the asserted behaviors are the acceptance criteria and must pass.

- [ ] **Step 6: Wire e2e into CI** — in `.github/workflows/ci.yml`, in the `web` job, after "Test web" add:

```yaml
      - name: Install Playwright browser
        run: pnpm --filter web exec playwright install --with-deps chromium
      - name: E2E
        run: pnpm --filter web test:e2e
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/playwright.config.ts apps/web/e2e .gitignore .github/workflows/ci.yml pnpm-lock.yaml
git commit -m "test(web): Playwright e2e for acceptance scenarios + CI wiring"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full local sequence**

```bash
pnpm install --frozen-lockfile
pnpm --filter @synopsis/schema test
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
pnpm --filter web test:e2e
```
Expected: all green.

- [ ] **Step 2: Browser smoke check** — preview, then verify console is clean on `/`, `/p/21`, `/search?q=Агнец Божий`, `/read/lk`, `/appendix`, and the settings drawer at 390px.

- [ ] **Step 3: Update the legacy-removal decision** — once parity is confirmed (this plan), Plan 3 (parser) is independent; the legacy `site/` + `build_site.py` removal is the final step after Plan 3 (or now, if the user confirms parity). Do not remove in this plan without explicit confirmation.

---

## Self-Review

**1. Spec coverage (2B scope):**
- Full-text search + reference parsing, client index → Tasks 1, 7. ✓ (acceptance: «Агнец Божий»→Ин 1:29/1:36; «Мф 3:13»→21; «Мф 5:3»→51.1 — unit + e2e)
- Single-gospel reading with chapter/pericope markers + dedup → Tasks 2, 8. ✓
- Prefaces / footnotes / chronology (scroll-contained) → Tasks 3, 9. ✓
- Bookmarks + continue-reading → Task 10. ✓
- Settings drawer (theme/font/serif/parallels), focus-trap, scrim layering, persists → Tasks 4, 6, 11, 12. ✓
- Component tests (PericopeColumns, SettingsDrawer) + Playwright e2e → Tasks 11, 12. ✓
- Adaptive 390px tabs + chronology scroll without page overflow → e2e Task 12. ✓
- CI runs e2e → Task 12. ✓

**2. Placeholder scan:** No placeholders; every code step is complete.

**3. Type/name consistency:** `buildSearchIndex`/`search`/`SearchIndex`/`SearchResult`/`VerseRecord` (Task 1) used in `/search` (Task 7); `buildReading`/`ReadingBlock` (Task 2) used in `/read/[g]` (Task 8); `SettingsDrawer` `open` bindable (Task 4) bound in layout (Task 6) and exercised in tests (Tasks 11, 12); `bookmarks`/`reading` stores (2A) used in Tasks 5, 10; `ScrollTable` (Task 3) used in `/appendix` (Task 9); search anchor format `g-ch-v` matches `VerseItem` `id` in PericopeColumns (2A). ✓

**Execution notes (from 2A, still in force):** node-default Vitest with per-file jsdom opt-in for component tests; `load` returns only serializable data; use resilient pnpm flags (`NPM_CONFIG_FETCH_RETRIES`, `NETWORK_CONCURRENCY=1`) on the flaky registry; commit messages end with the `Co-Authored-By: Claude Opus 4.8` trailer.
