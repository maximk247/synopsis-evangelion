# Plan 2A — Web Reader Foundation + Pericope Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (This repo is being executed inline on `master` per the user's instruction.)

> **STATUS: COMPLETED 2026-06-14.** Execution deviated from the written tasks in three deliberate ways (the tasks below are kept as originally written; this note is the source of truth where they differ):
> 1. **Node-only Vitest in 2A.** The local npm registry was unreliable and the Vitest browser-mode config API differs across versions, so 2A uses a single node-environment Vitest config (no `projects`, no `@vitest/browser`/`vitest-browser-svelte`/`vitest-setup-client.ts`). All required logic units (alignment, refs, loader, persist, settings store — 19 tests) run headless. **Task 15 (PericopeColumns browser component test) and Playwright e2e are deferred to Plan 2B**, where browser-mode testing is set up once.
> 2. **`load` returns plain serializable data, not the `SynopsisModel`.** SvelteKit serializes `load` output for prerender and functions are not serializable, so `+layout.ts` only sets `prerender`/`trailingSlash`, and each route's `+page.ts` calls the memoized `loadSynopsis(fetch)` and returns plain values (contents: `{ sections }`; pericope: `{ pericope, present, sectionTitle, prevId, nextId }`). `Breadcrumbs` takes `sectionTitle: string`; `ColumnTabs` uses an `onselect` callback instead of `bind:active`.
> 3. **Resolved versions:** kit 2.65, svelte 5.56, vite 6.4, vitest 3.2, adapter-static 3.0. Verified in a real browser (chrome-devtools): clean console, desktop 4-column /p/21 with bidirectional prev/next, 390px tab layout, contents filter + presence chips; full static build prerenders all 254 routes.

**Goal:** Stand up the SvelteKit reader (`apps/web`) — scaffold, data layer, persisted stores, theming — and ship the **Contents (`/`)** and **Pericope (`/p/[id]`)** pages so pericopes **12**, **21**, and **51.1** render correctly with parallel-verse highlighting, prev/next links, keyboard paging, breadcrumbs, mobile tabs, and verse deep-links. All pages prerender as pure static output.

**Architecture:** SvelteKit + Svelte 5 runes, TypeScript strict, `@sveltejs/adapter-static` with full prerender (`prerender = true` in the root layout; `entries()` for `/p/[id]` from a generated id list). The single `synopsis.json` (validated by `@synopsis/schema`) is copied to `static/data/` by a prebuild step and fetched once at load; derived indexes (by id, section, alignment map, reverse ref→pericope) are built in a memoized loader. State lives in rune-based stores over one SSR-safe `localStorage` module. Components render only typed data (no `innerHTML`); themes switch via `data-theme` + CSS variables.

**Tech Stack:** SvelteKit, Svelte 5, Vite, TypeScript 5 (strict), `@sveltejs/adapter-static`, Vitest (node + browser projects), `vitest-browser-svelte`, Playwright (browser provider), `@synopsis/schema` (workspace).

**Deferred to Plan 2B:** `/read/[g]`, search + reference search UI, `/prefaces` `/footnotes` `/appendix`, `/bookmarks` page, the settings drawer UI, and Playwright e2e. (The persisted settings *store* is built here; only its drawer UI is in 2B.)

---

## File Structure (locked in this plan)

```
apps/web/
├─ package.json                      # SvelteKit app, deps incl. @synopsis/schema (workspace:*)
├─ svelte.config.js                  # adapter-static + paths.base from env
├─ vite.config.ts                    # sveltekit plugin + vitest (node + browser projects)
├─ tsconfig.json                     # extends ./.svelte-kit/tsconfig.json
├─ playwright.config.ts              # created here, used in 2B (webServer wiring)
├─ vitest-setup-client.ts            # browser-project setup
├─ scripts/prepare-data.mjs          # copy synopsis.json -> static/data + emit pericope-ids.json
├─ static/data/synopsis.json         # generated (gitignored)
├─ src/
│  ├─ app.html                       # + inline no-FOUC theme script
│  ├─ app.d.ts
│  ├─ app.css                        # CSS variables: light/sepia/dark + base styles
│  ├─ lib/
│  │  ├─ generated/pericope-ids.json # generated (gitignored): ["1",...,"51.1",...]
│  │  ├─ data/
│  │  │  ├─ labels.ts                # GOSPEL_LABELS reexport + label helpers
│  │  │  ├─ alignment.ts             # buildAlignmentMap (pure)
│  │  │  ├─ refs.ts                  # parseRef / resolveRef (pure-ish)
│  │  │  └─ synopsis.ts              # loadSynopsis(fetch) -> SynopsisModel (memoized)
│  │  ├─ stores/
│  │  │  ├─ persist.ts               # SSR-safe typed localStorage
│  │  │  ├─ settings.svelte.ts       # theme/font/serif/highlight (persisted)
│  │  │  ├─ bookmarks.svelte.ts      # bookmark ids (persisted)
│  │  │  └─ reading.svelte.ts        # continue-reading position (persisted)
│  │  └─ components/
│  │     ├─ VerseItem.svelte
│  │     ├─ NoteItem.svelte
│  │     ├─ RefLinkBadge.svelte
│  │     ├─ GospelPresence.svelte
│  │     ├─ Breadcrumbs.svelte
│  │     ├─ Pager.svelte
│  │     ├─ PericopeColumns.svelte
│  │     ├─ PericopeColumns.svelte.test.ts
│  │     └─ ColumnTabs.svelte
│  └─ routes/
│     ├─ +layout.ts                  # prerender=true; load synopsis model
│     ├─ +layout.svelte              # header/nav, theme apply, font/serif classes
│     ├─ +page.svelte                # Contents (TOC) + filter
│     └─ p/[id]/
│        ├─ +page.ts                 # entries() from pericope-ids.json; load pericope
│        └─ +page.svelte             # Pericope view
```

Generated files (`static/data/`, `src/lib/generated/`) are gitignored (add patterns in Task 2).

---

### Task 1: Scaffold the SvelteKit app with adapter-static

**Files:**
- Create: `apps/web/package.json`, `apps/web/svelte.config.js`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/app.html`, `apps/web/src/app.d.ts`, `apps/web/src/routes/+layout.ts`, `apps/web/src/routes/+page.svelte`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "prepare": "svelte-kit sync",
    "predev": "node scripts/prepare-data.mjs",
    "dev": "vite dev",
    "prebuild": "node scripts/prepare-data.mjs",
    "build": "vite build",
    "preview": "vite preview",
    "pretest": "node scripts/prepare-data.mjs",
    "test": "vitest run",
    "typecheck": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "lint": "prettier --check . && eslint ."
  },
  "devDependencies": {
    "@synopsis/schema": "workspace:*",
    "@sveltejs/adapter-static": "^3.0.8",
    "@sveltejs/kit": "^2.15.1",
    "@sveltejs/vite-plugin-svelte": "^5.0.3",
    "@testing-library/jest-dom": "^6.6.3",
    "@vitest/browser": "^2.1.8",
    "playwright": "^1.49.1",
    "svelte": "^5.16.0",
    "svelte-check": "^4.1.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^2.1.8",
    "vitest-browser-svelte": "^0.0.1"
  }
}
```

Note on versions: these are floor `^` ranges. If `pnpm install` resolves newer compatible versions, that is expected. If `@vitest/browser`/`vitest-browser-svelte` resolve to a major that changes the API, prefer the versions the current `npx sv add vitest` would install — the goal (browser-mode component tests) is what matters.

- [ ] **Step 2: Create `apps/web/svelte.config.js`**

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: '404.html'
    }),
    paths: {
      // Default '' works for Vercel/root. Set BASE_PATH for a subpath deploy.
      base: process.env.BASE_PATH ?? ''
    }
  }
};

export default config;
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

Two Vitest projects: `client` (browser, for `*.svelte.test.ts`) and `server` (node, for `*.test.ts` logic incl. `*.svelte.ts` runes).

```ts
/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          environment: 'browser',
          browser: {
            enabled: true,
            provider: 'playwright',
            instances: [{ browser: 'chromium' }]
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          setupFiles: ['./vitest-setup-client.ts']
        }
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
        }
      }
    ]
  }
});
```

- [ ] **Step 4: Create `apps/web/vitest-setup-client.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 6: Create `apps/web/src/app.html`** (with no-FOUC theme bootstrap)

```html
<!doctype html>
<html lang="ru" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>
      try {
        const s = localStorage.getItem('synopsis:settings');
        if (s) {
          const v = JSON.parse(s);
          if (v.theme) document.documentElement.dataset.theme = v.theme;
          if (v.fontSize) document.documentElement.dataset.font = v.fontSize;
          document.documentElement.dataset.serif = v.serif === false ? 'off' : 'on';
        }
      } catch (e) {}
    </script>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 7: Create `apps/web/src/app.d.ts`**

```ts
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
```

- [ ] **Step 8: Create placeholder `apps/web/src/routes/+layout.ts`** (replaced fully in Task 10)

```ts
export const prerender = true;
```

- [ ] **Step 9: Create placeholder `apps/web/src/routes/+page.svelte`** (replaced in Task 13)

```svelte
<h1>Евангельский синопсис</h1>
```

- [ ] **Step 10: Install and sync**

Run: `pnpm install`
Then: `pnpm --filter web exec svelte-kit sync`
Expected: install completes; `apps/web/.svelte-kit/` is generated (so `tsconfig.json`'s `extends` resolves).

- [ ] **Step 11: Verify the dev server boots and the placeholder renders**

Run (background, then stop): `pnpm --filter web dev`
Expected: Vite prints a local URL (default `http://localhost:5173`), console is clean, the page shows the heading. (Task 2 must run first if `predev` fails because data is missing — but `prepare-data.mjs` does not exist yet; for THIS step, if `predev` errors, run `pnpm --filter web exec vite dev` directly to bypass it, confirm boot, then stop. Task 2 adds the data script.)

- [ ] **Step 12: Add favicon placeholder**

Create an empty-safe favicon to avoid 404 noise:
Run: `node -e "require('fs').mkdirSync('apps/web/static',{recursive:true}); require('fs').writeFileSync('apps/web/static/favicon.png', Buffer.alloc(0))"`

- [ ] **Step 13: Commit**

```bash
git add apps/web/package.json apps/web/svelte.config.js apps/web/vite.config.ts apps/web/tsconfig.json apps/web/vitest-setup-client.ts apps/web/src/app.html apps/web/src/app.d.ts apps/web/src/routes/+layout.ts apps/web/src/routes/+page.svelte apps/web/static/favicon.png pnpm-lock.yaml
git commit -m "feat(web): scaffold SvelteKit app with adapter-static and vitest projects"
```
(End every commit message with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.)

---

### Task 2: Prebuild data step (copy JSON + emit id list)

The app reads `synopsis.json` as a static asset and needs the list of pericope ids (plus alias ids) at build time for prerender `entries()`. One cross-platform Node script produces both.

**Files:**
- Create: `apps/web/scripts/prepare-data.mjs`
- Modify: `.gitignore` (append generated paths)

- [ ] **Step 1: Create `apps/web/scripts/prepare-data.mjs`**

```js
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const src = resolve(repoRoot, 'data/synopsis.json');

const staticDir = resolve(here, '../static/data');
const genDir = resolve(here, '../src/lib/generated');
mkdirSync(staticDir, { recursive: true });
mkdirSync(genDir, { recursive: true });

// 1) copy the data file verbatim to be served at /data/synopsis.json
copyFileSync(src, resolve(staticDir, 'synopsis.json'));

// 2) emit the id list for prerender entries (pericope ids + alias keys)
const data = JSON.parse(readFileSync(src, 'utf8'));
const ids = new Set();
for (const p of data.pericopes) ids.add(p.id);
for (const alias of Object.keys(data.aliases ?? {})) ids.add(alias);
writeFileSync(
  resolve(genDir, 'pericope-ids.json'),
  JSON.stringify([...ids], null, 0) + '\n'
);

console.log(`prepare-data: copied synopsis.json, emitted ${ids.size} ids`);
```

- [ ] **Step 2: Append generated paths to root `.gitignore`**

Add these lines at the end of `.gitignore`:

```gitignore
# Generated web data
apps/web/static/data/
apps/web/src/lib/generated/
```

- [ ] **Step 3: Run the script and verify outputs**

Run: `node apps/web/scripts/prepare-data.mjs`
Expected: prints `prepare-data: copied synopsis.json, emitted 254 ids` (253 pericopes + 1 alias `99.9`). Verify:
Run: `node -e "const a=require('./apps/web/src/lib/generated/pericope-ids.json'); console.log(a.length, a.includes('51.1'), a.includes('99.9'))"`
Expected: `254 true true`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/scripts/prepare-data.mjs .gitignore
git commit -m "feat(web): prebuild step copies synopsis.json and emits pericope id list"
```

---

### Task 3: Theming and base styles (`app.css`)

CSS variables drive three themes via `data-theme` on `<html>`; `data-font` scales type; `data-serif` toggles the verse typeface.

**Files:**
- Create: `apps/web/src/app.css`

- [ ] **Step 1: Create `apps/web/src/app.css`**

```css
:root {
  --bg: #ffffff;
  --bg-soft: #f5f5f4;
  --fg: #1c1917;
  --fg-muted: #57534e;
  --border: #e7e5e4;
  --accent: #1d4ed8;
  --accent-soft: #dbeafe;
  --highlight: #fff3bf;
  --font-ui: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-serif: 'Georgia', 'Times New Roman', serif;
  --fs-base: 17px;
}

:root[data-theme='sepia'] {
  --bg: #f4ecd8;
  --bg-soft: #ece0c4;
  --fg: #4b3f2f;
  --fg-muted: #6b5d49;
  --border: #d8c9a8;
  --accent: #9a6b1f;
  --accent-soft: #ecd9b0;
  --highlight: #e6d29a;
}

:root[data-theme='dark'] {
  --bg: #16161a;
  --bg-soft: #232329;
  --fg: #e7e5e4;
  --fg-muted: #a8a29e;
  --border: #33333a;
  --accent: #7aa2f7;
  --accent-soft: #29304a;
  --highlight: #4d4626;
}

:root[data-font='sm'] { --fs-base: 15px; }
:root[data-font='md'] { --fs-base: 17px; }
:root[data-font='lg'] { --fs-base: 20px; }

* { box-sizing: border-box; }

html { background: var(--bg); }

body {
  margin: 0;
  color: var(--fg);
  background: var(--bg);
  font-family: var(--font-ui);
  font-size: var(--fs-base);
  line-height: 1.5;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.verse-text { font-family: var(--font-ui); }
:root[data-serif='on'] .verse-text { font-family: var(--font-serif); }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app.css
git commit -m "feat(web): theme tokens and base styles (light/sepia/dark)"
```

---

### Task 4: `lib/data/labels.ts` — gospel labels

**Files:**
- Create: `apps/web/src/lib/data/labels.ts`

- [ ] **Step 1: Create `apps/web/src/lib/data/labels.ts`**

```ts
import { GOSPELS, GOSPEL_LABELS, type GospelKey } from '@synopsis/schema';

export { GOSPELS, GOSPEL_LABELS };
export type { GospelKey };

/** "Евангелие от Луки" — genitive from the case table, never concatenation. */
export function gospelHeading(g: GospelKey): string {
  return `Евангелие от ${GOSPEL_LABELS[g].gen}`;
}

/** Short column label, e.g. "Мф" / "Матфей". */
export function gospelAbbr(g: GospelKey): string {
  return GOSPEL_LABELS[g].abbr;
}
export function gospelNom(g: GospelKey): string {
  return GOSPEL_LABELS[g].nom;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/data/labels.ts
git commit -m "feat(web): gospel label helpers from the case-form table"
```

---

### Task 5: `lib/data/alignment.ts` — parallel-verse map (TDD)

`buildAlignmentMap` turns a pericope's `alignment` rows into a lookup from a verse key (`"mt-3-13"`) to a row id, so a verse can highlight all parallels in its row.

**Files:**
- Create: `apps/web/src/lib/data/alignment.ts`
- Test: `apps/web/src/lib/data/alignment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { buildAlignmentMap, verseKey } from './alignment.js';
import type { Pericope } from '@synopsis/schema';

const pericope = {
  alignment: [
    { mt: '3:13', mk: '1:9' },
    { mt: '3:14' },
    { mt: '3:16', mk: '1:10', lk: '3:21' }
  ]
} as unknown as Pericope;

describe('buildAlignmentMap', () => {
  it('maps each verse key to its row index', () => {
    const map = buildAlignmentMap(pericope);
    expect(map.get('mt-3-13')).toBe(0);
    expect(map.get('mk-1-9')).toBe(0);
    expect(map.get('mt-3-14')).toBe(1);
    expect(map.get('lk-3-21')).toBe(2);
    expect(map.get('mk-1-10')).toBe(2);
  });

  it('returns an empty map when alignment is null', () => {
    const map = buildAlignmentMap({ alignment: null } as unknown as Pericope);
    expect(map.size).toBe(0);
  });

  it('verseKey ignores suffix letters (aligns by chapter:verse)', () => {
    expect(verseKey('mt', 3, 13)).toBe('mt-3-13');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run src/lib/data/alignment.test.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Implement `apps/web/src/lib/data/alignment.ts`**

```ts
import type { GospelKey } from '@synopsis/schema';
import type { Pericope } from '@synopsis/schema';

const GOSPEL_KEYS = ['mt', 'mk', 'lk', 'jn'] as const;

/** Stable key for a verse within a pericope, e.g. ("mt", 3, 13) -> "mt-3-13". */
export function verseKey(gospel: GospelKey, chapter: number, verse: number): string {
  return `${gospel}-${chapter}-${verse}`;
}

/** Parse an alignment value "3:13" into [chapter, verse]; null if malformed. */
function parseChapterVerse(value: string): [number, number] | null {
  const m = /^(\d+):(\d+)/.exec(value.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

/**
 * Map verse key -> alignment row index. Verses sharing a row are parallels.
 * Returns an empty map when the pericope has no alignment.
 */
export function buildAlignmentMap(pericope: Pericope): Map<string, number> {
  const map = new Map<string, number>();
  const rows = pericope.alignment;
  if (!rows) return map;
  rows.forEach((row, index) => {
    for (const g of GOSPEL_KEYS) {
      const value = row[g];
      if (!value) continue;
      const cv = parseChapterVerse(value);
      if (!cv) continue;
      map.set(verseKey(g, cv[0], cv[1]), index);
    }
  });
  return map;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run src/lib/data/alignment.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data/alignment.ts apps/web/src/lib/data/alignment.test.ts
git commit -m "feat(web): buildAlignmentMap for parallel-verse highlighting"
```

---

### Task 6: `lib/data/refs.ts` — reference parsing (TDD)

`parseRef` turns a human reference (`"Мф 5:3"`, `"Ин.1:29"`) into `{ gospel, chapter, verse }`. `resolveRef` finds the pericope whose columns contain that verse (used by search in 2B; the resolver takes an index built in Task 7).

**Files:**
- Create: `apps/web/src/lib/data/refs.ts`
- Test: `apps/web/src/lib/data/refs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { parseRef } from './refs.js';

describe('parseRef', () => {
  it('parses "Мф 5:3"', () => {
    expect(parseRef('Мф 5:3')).toEqual({ gospel: 'mt', chapter: 5, verse: 3 });
  });
  it('parses "Ин.1:29" with a dot separator', () => {
    expect(parseRef('Ин.1:29')).toEqual({ gospel: 'jn', chapter: 1, verse: 29 });
  });
  it('parses full names and abbreviations', () => {
    expect(parseRef('Матфей 3:13')).toEqual({ gospel: 'mt', chapter: 3, verse: 13 });
    expect(parseRef('Мк 1:9')).toEqual({ gospel: 'mk', chapter: 1, verse: 9 });
    expect(parseRef('Лк 6:20')).toEqual({ gospel: 'lk', chapter: 6, verse: 20 });
  });
  it('parses chapter-only references (verse defaults to undefined)', () => {
    expect(parseRef('Мф 5')).toEqual({ gospel: 'mt', chapter: 5, verse: undefined });
  });
  it('returns null for non-references', () => {
    expect(parseRef('Агнец Божий')).toBeNull();
    expect(parseRef('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run src/lib/data/refs.test.ts`
Expected: FAIL — `parseRef` not found.

- [ ] **Step 3: Implement `apps/web/src/lib/data/refs.ts`**

```ts
import type { GospelKey } from '@synopsis/schema';

export interface ParsedRef {
  gospel: GospelKey;
  chapter: number;
  verse: number | undefined;
}

/** Accepted spellings -> gospel key (lowercased, dots stripped before lookup). */
const NAME_TO_GOSPEL: Record<string, GospelKey> = {
  мф: 'mt', мат: 'mt', матф: 'mt', матфей: 'mt', матфея: 'mt',
  мк: 'mk', мар: 'mk', марк: 'mk', марка: 'mk',
  лк: 'lk', лук: 'lk', лука: 'lk', луки: 'lk',
  ин: 'jn', иоанн: 'jn', иоанна: 'jn', иоан: 'jn'
};

/**
 * Parse a scripture reference like "Мф 5:3", "Ин.1:29", "Лк 6", "Матфей 3:13".
 * Returns null when the input is not a recognizable reference.
 */
export function parseRef(input: string): ParsedRef | null {
  const text = input.trim();
  if (!text) return null;
  // name, then chapter, optional :verse — separators may be space or dot.
  const m = /^([А-Яа-яЁё]+)\.?\s*(\d+)(?::(\d+))?/.exec(text);
  if (!m) return null;
  const name = m[1]!.toLowerCase().replace(/ё/g, 'е');
  const gospel = NAME_TO_GOSPEL[name];
  if (!gospel) return null;
  const chapter = Number(m[2]);
  const verse = m[3] !== undefined ? Number(m[3]) : undefined;
  return { gospel, chapter, verse };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run src/lib/data/refs.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data/refs.ts apps/web/src/lib/data/refs.test.ts
git commit -m "feat(web): parseRef for scripture-reference search"
```

---

### Task 7: `lib/data/synopsis.ts` — loader + derived indexes (TDD)

Loads + validates `synopsis.json` (via `@synopsis/schema`) and builds derived structures used across the app. The model is memoized so prerendering 250+ pages doesn't rebuild indexes each time. `resolveRef` lives here because it needs the reverse index built from `columns`.

**Files:**
- Create: `apps/web/src/lib/data/synopsis.ts`
- Test: `apps/web/src/lib/data/synopsis.test.ts`

- [ ] **Step 1: Write the failing test** (uses the real data via a fetch shim)

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildModel } from './synopsis.js';

const raw = JSON.parse(
  readFileSync(new URL('../../../../../data/synopsis.json', import.meta.url), 'utf8')
);
const model = buildModel(raw);

describe('buildModel', () => {
  it('indexes pericopes by id including nested ids', () => {
    expect(model.byId.get('12')?.title).toBeTruthy();
    expect(model.byId.get('51.1')?.title).toContain('блаженств');
  });

  it('resolves aliases (99.9 -> 99.8)', () => {
    expect(model.resolveId('99.9')).toBe('99.8');
    expect(model.resolveId('21')).toBe('21');
  });

  it('maps each pericope to its section', () => {
    expect(model.sectionOf('12')).toBeTruthy();
  });

  it('reports gospel presence from columns', () => {
    const p12 = model.byId.get('12')!;
    const present = model.gospelsPresent(p12);
    expect(present).toEqual(['lk']);
  });

  it('resolveRef finds pericope 21 for Мф 3:13 and 51.1 for Мф 5:3', () => {
    expect(model.resolveRef({ gospel: 'mt', chapter: 3, verse: 13 })?.id).toBe('21');
    expect(model.resolveRef({ gospel: 'mt', chapter: 5, verse: 3 })?.id).toBe('51.1');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run src/lib/data/synopsis.test.ts`
Expected: FAIL — `buildModel` not found.

- [ ] **Step 3: Implement `apps/web/src/lib/data/synopsis.ts`**

```ts
import {
  parseSynopsis,
  type GospelKey,
  type Pericope,
  type Section,
  type Synopsis
} from '@synopsis/schema';
import { isVerse } from '@synopsis/schema';
import type { ParsedRef } from './refs.js';

const GOSPEL_KEYS = ['mt', 'mk', 'lk', 'jn'] as const;

export interface SynopsisModel {
  raw: Synopsis;
  byId: Map<string, Pericope>;
  resolveId(id: string): string;
  sectionOf(id: string): Section | undefined;
  gospelsPresent(p: Pericope): GospelKey[];
  resolveRef(ref: ParsedRef): { id: string; gospel: GospelKey } | null;
}

/** Build derived indexes from already-parsed data. Pure (no I/O). */
export function buildModel(data: unknown): SynopsisModel {
  const raw = parseSynopsis(data);

  const byId = new Map<string, Pericope>();
  for (const p of raw.pericopes) byId.set(p.id, p);

  const sectionByPericope = new Map<string, Section>();
  for (const s of raw.sections) {
    for (const pid of s.pericopeIds) sectionByPericope.set(pid, s);
  }

  // reverse index: "gospel-chapter-verse" -> pericope id, built from columns
  const verseToPericope = new Map<string, string>();
  for (const p of raw.pericopes) {
    for (const g of GOSPEL_KEYS) {
      const col = p.columns[g];
      if (!col) continue;
      for (const seg of col.segments) {
        for (const item of seg.items) {
          if (!isVerse(item)) continue;
          const key = `${g}-${seg.chapter}-${item.v}`;
          if (!verseToPericope.has(key)) verseToPericope.set(key, p.id);
        }
      }
    }
  }

  function resolveId(id: string): string {
    return raw.aliases[id] ?? id;
  }

  function gospelsPresent(p: Pericope): GospelKey[] {
    return GOSPEL_KEYS.filter((g) => p.columns[g] !== null);
  }

  function resolveRef(ref: ParsedRef): { id: string; gospel: GospelKey } | null {
    if (ref.verse !== undefined) {
      const id = verseToPericope.get(`${ref.gospel}-${ref.chapter}-${ref.verse}`);
      if (id) return { id, gospel: ref.gospel };
    }
    // chapter-only or verse miss: first pericope containing that chapter
    for (const p of raw.pericopes) {
      const col = p.columns[ref.gospel];
      if (!col) continue;
      if (col.segments.some((seg) => seg.chapter === ref.chapter)) {
        return { id: p.id, gospel: ref.gospel };
      }
    }
    return null;
  }

  return {
    raw,
    byId,
    resolveId,
    sectionOf: (id) => sectionByPericope.get(id),
    gospelsPresent,
    resolveRef
  };
}

let cached: SynopsisModel | null = null;

/** Fetch + validate + index synopsis.json once. Safe to call per page (memoized). */
export async function loadSynopsis(fetchFn: typeof fetch): Promise<SynopsisModel> {
  if (cached) return cached;
  const res = await fetchFn('/data/synopsis.json');
  if (!res.ok) throw new Error(`Failed to load synopsis.json: ${res.status}`);
  cached = buildModel(await res.json());
  return cached;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run src/lib/data/synopsis.test.ts`
Expected: PASS (5 tests). If `resolveRef` for `Мф 5:3` does not return `51.1`, inspect the columns of `51.1` (it must contain `mt` chapter 5 verse 3) — adjust nothing in data; the assertion is derived from the verified contract.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/data/synopsis.ts apps/web/src/lib/data/synopsis.test.ts
git commit -m "feat(web): synopsis loader with id/section/presence/ref indexes"
```

---

### Task 8: `lib/stores/persist.ts` — SSR-safe localStorage (TDD)

**Files:**
- Create: `apps/web/src/lib/stores/persist.ts`
- Test: `apps/web/src/lib/stores/persist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run src/lib/stores/persist.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/stores/persist.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter web exec vitest run src/lib/stores/persist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/stores/persist.ts apps/web/src/lib/stores/persist.test.ts
git commit -m "feat(web): SSR-safe namespaced localStorage helpers"
```

---

### Task 9: Rune stores — settings / bookmarks / reading (TDD)

`settings` persists under one key `settings` (matching the no-FOUC script in `app.html`). Setters write through immediately and apply DOM attributes; no module-level `$effect`.

**Files:**
- Create: `apps/web/src/lib/stores/settings.svelte.ts`
- Create: `apps/web/src/lib/stores/bookmarks.svelte.ts`
- Create: `apps/web/src/lib/stores/reading.svelte.ts`
- Test: `apps/web/src/lib/stores/settings.svelte.test.ts`

- [ ] **Step 1: Write the failing test** (runs in the node project — `.svelte.ts` runes compile there)

File: `apps/web/src/lib/stores/settings.svelte.test.ts`

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
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter web exec vitest run src/lib/stores/settings.svelte.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/stores/settings.svelte.ts`**

```ts
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

  setTheme(t: Theme) { this.theme = t; this.persist(); this.apply(); }
  setFontSize(f: FontSize) { this.fontSize = f; this.persist(); this.apply(); }
  setSerif(on: boolean) { this.serif = on; this.persist(); this.apply(); }
  setHighlightParallels(on: boolean) { this.highlightParallels = on; this.persist(); }
}

export const settings = new SettingsStore();
```

- [ ] **Step 4: Implement `apps/web/src/lib/stores/bookmarks.svelte.ts`**

```ts
import { readJSON, writeJSON } from './persist.js';

export class BookmarksStore {
  ids = $state<string[]>([]);

  constructor() {
    this.ids = readJSON<string[]>('bookmarks', []);
  }

  private persist() { writeJSON('bookmarks', this.ids); }

  has(id: string): boolean { return this.ids.includes(id); }

  toggle(id: string) {
    this.ids = this.has(id) ? this.ids.filter((x) => x !== id) : [...this.ids, id];
    this.persist();
  }
}

export const bookmarks = new BookmarksStore();
```

- [ ] **Step 5: Implement `apps/web/src/lib/stores/reading.svelte.ts`**

```ts
import { readJSON, writeJSON } from './persist.js';

export interface ReadingPosition {
  id: string;
  title: string;
}

export class ReadingStore {
  last = $state<ReadingPosition | null>(null);

  constructor() {
    this.last = readJSON<ReadingPosition | null>('reading', null);
  }

  set(pos: ReadingPosition) {
    this.last = pos;
    writeJSON('reading', pos);
  }
}

export const reading = new ReadingStore();
```

- [ ] **Step 6: Run to verify pass**

Run: `pnpm --filter web exec vitest run src/lib/stores/settings.svelte.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/stores/settings.svelte.ts apps/web/src/lib/stores/bookmarks.svelte.ts apps/web/src/lib/stores/reading.svelte.ts apps/web/src/lib/stores/settings.svelte.test.ts
git commit -m "feat(web): persisted rune stores for settings, bookmarks, reading"
```

---

### Task 10: Root layout — load model + apply theme + header/nav

**Files:**
- Modify: `apps/web/src/routes/+layout.ts`
- Create: `apps/web/src/routes/+layout.svelte`

- [ ] **Step 1: Replace `apps/web/src/routes/+layout.ts`**

```ts
import { loadSynopsis } from '$lib/data/synopsis.js';
import type { LayoutLoad } from './$types';

export const prerender = true;
export const trailingSlash = 'ignore';

export const load: LayoutLoad = async ({ fetch }) => {
  const model = await loadSynopsis(fetch);
  return { model };
};
```

- [ ] **Step 2: Create `apps/web/src/routes/+layout.svelte`**

```svelte
<script lang="ts">
  import '../app.css';
  import { base } from '$app/paths';
  import { settings } from '$lib/stores/settings.svelte.js';

  let { children } = $props();

  // Apply persisted settings to <html> on the client.
  $effect(() => {
    settings.apply();
  });
</script>

<a class="skip-link" href="#main">К содержанию</a>

<header class="topbar">
  <nav class="topbar__inner">
    <a class="brand" href="{base}/">Евангельский синопсис</a>
    <div class="spacer"></div>
    <!-- Search and settings UI arrive in Plan 2B -->
  </nav>
</header>

<main id="main" class="container">
  {@render children()}
</main>

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
  }
  .brand { font-weight: 600; color: var(--fg); }
  .spacer { flex: 1; }
  .container { max-width: 1100px; margin: 0 auto; padding: 1rem; }
  .skip-link {
    position: absolute;
    left: -9999px;
  }
  .skip-link:focus {
    left: 1rem;
    top: 0.5rem;
    z-index: 20;
    background: var(--bg);
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
  }
</style>
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter web typecheck`
Expected: `svelte-check` reports 0 errors. (If `$types` import errors, run `pnpm --filter web exec svelte-kit sync` first.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/+layout.ts apps/web/src/routes/+layout.svelte
git commit -m "feat(web): root layout loads synopsis model and applies theme"
```

---

### Task 11: Small presentational components

**Files:**
- Create: `VerseItem.svelte`, `NoteItem.svelte`, `RefLinkBadge.svelte`, `GospelPresence.svelte`, `Breadcrumbs.svelte`, `Pager.svelte` (all under `apps/web/src/lib/components/`)

- [ ] **Step 1: `VerseItem.svelte`**

```svelte
<script lang="ts">
  import type { VerseItem } from '@synopsis/schema';
  let {
    item,
    id,
    highlighted = false,
    onhover
  }: {
    item: VerseItem;
    id: string;
    highlighted?: boolean;
    onhover?: (key: string | null) => void;
  } = $props();
</script>

<span
  class="verse"
  class:highlighted
  {id}
  onmouseenter={() => onhover?.(id)}
  onmouseleave={() => onhover?.(null)}
  role="text"
>
  <sup class="vnum">{item.v}{item.suf}</sup>
  <span class="verse-text">{item.t}</span>
</span>

<style>
  .verse { display: inline; scroll-margin-top: 4rem; }
  .vnum { color: var(--fg-muted); font-weight: 600; margin-right: 0.15em; }
  .highlighted { background: var(--highlight); border-radius: 3px; }
</style>
```

- [ ] **Step 2: `NoteItem.svelte`**

```svelte
<script lang="ts">
  import type { NoteItem } from '@synopsis/schema';
  let { item }: { item: NoteItem } = $props();
</script>

<span class="note verse-text">{item.note}</span>

<style>
  .note { display: inline; font-style: italic; color: var(--fg-muted); }
</style>
```

- [ ] **Step 3: `RefLinkBadge.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import type { RefLink } from '@synopsis/schema';
  let { link, kind }: { link: RefLink; kind: 'prev' | 'next' } = $props();
  const label = kind === 'prev' ? 'ранее' : 'далее';
</script>

<a class="reflink" href="{base}/p/{link.p}" title="Перейти к перикопе {link.p}">
  {label}: {link.ref} <span class="pid">(п. {link.p})</span>
</a>

<style>
  .reflink {
    display: inline-block;
    font-size: 0.85em;
    color: var(--fg-muted);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    margin: 0.1rem 0.2rem 0.1rem 0;
  }
  .reflink:hover { color: var(--accent); text-decoration: none; }
  .pid { opacity: 0.7; }
</style>
```

- [ ] **Step 4: `GospelPresence.svelte`**

```svelte
<script lang="ts">
  import { GOSPELS, GOSPEL_LABELS, type GospelKey } from '$lib/data/labels.js';
  let { present }: { present: GospelKey[] } = $props();
</script>

<span class="presence" aria-label="Евангелия в перикопе">
  {#each GOSPELS as g (g)}
    <span class="chip" class:on={present.includes(g)} aria-hidden="true">
      {GOSPEL_LABELS[g].abbr}
    </span>
  {/each}
</span>

<style>
  .presence { display: inline-flex; gap: 0.2rem; }
  .chip {
    font-size: 0.72em;
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    color: var(--fg-muted);
    opacity: 0.35;
  }
  .chip.on { opacity: 1; color: var(--accent); border-color: var(--accent); }
</style>
```

- [ ] **Step 5: `Breadcrumbs.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  let {
    section,
    current
  }: {
    section?: { title: string } | undefined;
    current: string;
  } = $props();
</script>

<nav class="crumbs" aria-label="Хлебные крошки">
  <a href="{base}/">Содержание</a>
  {#if section}<span aria-hidden="true">›</span> <span>{section.title}</span>{/if}
  <span aria-hidden="true">›</span> <b>{current}</b>
</nav>

<style>
  .crumbs { font-size: 0.85em; color: var(--fg-muted); margin: 0.5rem 0 1rem; }
  .crumbs a { color: var(--fg-muted); }
</style>
```

- [ ] **Step 6: `Pager.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let {
    prevId,
    nextId
  }: {
    prevId?: string | undefined;
    nextId?: string | undefined;
  } = $props();

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && prevId) goto(`${base}/p/${prevId}`);
      if (e.key === 'ArrowRight' && nextId) goto(`${base}/p/${nextId}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="pager">
  {#if prevId}
    <a class="pbtn" href="{base}/p/{prevId}" aria-label="Предыдущая перикопа">‹ Пред.</a>
  {:else}
    <span class="pbtn disabled" aria-hidden="true">‹ Пред.</span>
  {/if}
  {#if nextId}
    <a class="pbtn" href="{base}/p/{nextId}" aria-label="Следующая перикопа">След. ›</a>
  {:else}
    <span class="pbtn disabled" aria-hidden="true">След. ›</span>
  {/if}
</div>

<style>
  .pager { display: flex; justify-content: space-between; gap: 1rem; margin: 1.5rem 0; }
  .pbtn { border: 1px solid var(--border); border-radius: 6px; padding: 0.4rem 0.8rem; }
  .pbtn.disabled { color: var(--fg-muted); opacity: 0.4; }
</style>
```

- [ ] **Step 7: Verify typecheck and commit**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

```bash
git add apps/web/src/lib/components/VerseItem.svelte apps/web/src/lib/components/NoteItem.svelte apps/web/src/lib/components/RefLinkBadge.svelte apps/web/src/lib/components/GospelPresence.svelte apps/web/src/lib/components/Breadcrumbs.svelte apps/web/src/lib/components/Pager.svelte
git commit -m "feat(web): presentational components (verse, note, reflink, presence, crumbs, pager)"
```

---

### Task 12: PericopeColumns + ColumnTabs

`PericopeColumns` renders equal-width columns for present gospels (desktop) and tab-switching for narrow screens (`ColumnTabs`). It builds the alignment map and coordinates hover-highlighting of parallel verses.

**Files:**
- Create: `apps/web/src/lib/components/PericopeColumns.svelte`
- Create: `apps/web/src/lib/components/ColumnTabs.svelte`

- [ ] **Step 1: `ColumnTabs.svelte`**

```svelte
<script lang="ts">
  import { GOSPEL_LABELS, type GospelKey } from '$lib/data/labels.js';
  let {
    gospels,
    active = $bindable()
  }: {
    gospels: GospelKey[];
    active: GospelKey;
  } = $props();
</script>

<div class="tabs" role="tablist">
  {#each gospels as g (g)}
    <button
      role="tab"
      aria-selected={active === g}
      class:active={active === g}
      onclick={() => (active = g)}
    >
      {GOSPEL_LABELS[g].nom}
    </button>
  {/each}
</div>

<style>
  .tabs { display: flex; gap: 0.25rem; margin-bottom: 0.75rem; }
  .tabs button {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
    border-radius: 6px;
    font: inherit;
    cursor: pointer;
  }
  .tabs button.active { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
</style>
```

- [ ] **Step 2: `PericopeColumns.svelte`**

```svelte
<script lang="ts">
  import type { Pericope, GospelKey, Segment } from '@synopsis/schema';
  import { isVerse } from '@synopsis/schema';
  import { GOSPEL_LABELS } from '$lib/data/labels.js';
  import { buildAlignmentMap, verseKey } from '$lib/data/alignment.js';
  import { settings } from '$lib/stores/settings.svelte.js';
  import VerseItem from './VerseItem.svelte';
  import NoteItem from './NoteItem.svelte';
  import RefLinkBadge from './RefLinkBadge.svelte';
  import ColumnTabs from './ColumnTabs.svelte';

  let { pericope, present }: { pericope: Pericope; present: GospelKey[] } = $props();

  const alignMap = $derived(buildAlignmentMap(pericope));
  let hoveredRow = $state<number | null>(null);
  let activeTab = $state<GospelKey>(present[0] ?? 'mt');

  // keep the active tab valid if `present` changes
  $effect(() => {
    if (!present.includes(activeTab)) activeTab = present[0] ?? 'mt';
  });

  function itemKey(g: GospelKey, seg: Segment, v: number): string {
    return verseKey(g, seg.chapter, v);
  }
  function rowOf(g: GospelKey, seg: Segment, v: number): number | undefined {
    return alignMap.get(itemKey(g, seg, v));
  }
  function isHot(g: GospelKey, seg: Segment, v: number): boolean {
    if (!settings.highlightParallels || hoveredRow === null) return false;
    return rowOf(g, seg, v) === hoveredRow;
  }
  function onHover(g: GospelKey, seg: Segment, v: number, on: boolean) {
    hoveredRow = on ? (rowOf(g, seg, v) ?? null) : null;
  }
</script>

<!-- Mobile: tabs (CSS shows this only at <=760px) -->
<div class="mobile-only">
  <ColumnTabs gospels={present} bind:active={activeTab} />
</div>

<div class="grid" style="--cols: {present.length}">
  {#each present as g (g)}
    {@const col = pericope.columns[g]}
    <section
      class="col"
      class:mobile-active={g === activeTab}
      aria-label={GOSPEL_LABELS[g].nom}
    >
      <h2 class="col__head">{GOSPEL_LABELS[g].nom}</h2>
      {#if col}
        {#each col.segments as seg (g + '-' + seg.chapter)}
          <div class="seg">
            {#if seg.prev}<RefLinkBadge link={seg.prev} kind="prev" />{/if}
            <p class="chapter">Гл. {seg.chapter}</p>
            <p class="flow">
              {#each seg.items as item, i (i)}
                {#if isVerse(item)}
                  <VerseItem
                    item={item}
                    id={itemKey(g, seg, item.v)}
                    highlighted={isHot(g, seg, item.v)}
                    onhover={(key) => onHover(g, seg, item.v, key !== null)}
                  />{' '}
                {:else}
                  <NoteItem {item} />{' '}
                {/if}
              {/each}
            </p>
            {#if seg.next}<RefLinkBadge link={seg.next} kind="next" />{/if}
          </div>
        {/each}
      {/if}
    </section>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 1.25rem;
    align-items: start;
  }
  .col { min-width: 0; }
  .col__head {
    font-size: 1rem;
    margin: 0 0 0.5rem;
    padding-bottom: 0.3rem;
    border-bottom: 2px solid var(--border);
  }
  .chapter { color: var(--fg-muted); font-size: 0.8em; margin: 0.5rem 0 0.25rem; }
  .flow { margin: 0 0 0.5rem; }
  .seg { margin-bottom: 0.75rem; }
  .mobile-only { display: none; }

  @media (max-width: 760px) {
    .grid { grid-template-columns: 1fr; gap: 0; }
    .mobile-only { display: block; }
    .col { display: none; }
    .col.mobile-active { display: block; }
    .col__head { display: none; }
  }
</style>
```

- [ ] **Step 3: Verify typecheck and commit**

Run: `pnpm --filter web typecheck`
Expected: 0 errors.

```bash
git add apps/web/src/lib/components/PericopeColumns.svelte apps/web/src/lib/components/ColumnTabs.svelte
git commit -m "feat(web): PericopeColumns with parallel highlight and mobile tabs"
```

---

### Task 13: Contents page (`/`)

Lists sections with their pericopes, a filter over number/title/reference, and gospel-presence chips.

**Files:**
- Replace: `apps/web/src/routes/+page.svelte`

- [ ] **Step 1: Replace `apps/web/src/routes/+page.svelte`**

```svelte
<script lang="ts">
  import { base } from '$app/paths';
  import GospelPresence from '$lib/components/GospelPresence.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const model = data.model;

  let query = $state('');

  const normalized = $derived(query.trim().toLowerCase());

  function matches(pid: string): boolean {
    if (!normalized) return true;
    const p = model.byId.get(pid);
    if (!p) return false;
    if (p.id.toLowerCase().includes(normalized)) return true;
    if (p.title.toLowerCase().includes(normalized)) return true;
    if (p.place && p.place.toLowerCase().includes(normalized)) return true;
    return false;
  }
</script>

<svelte:head><title>Евангельский синопсис — содержание</title></svelte:head>

<h1>Содержание</h1>

<input
  class="filter"
  type="search"
  placeholder="Фильтр: номер, название или место…"
  bind:value={query}
  aria-label="Фильтр перикоп"
/>

{#each model.raw.sections as section (section.id)}
  {@const visible = section.pericopeIds.filter(matches)}
  {#if visible.length}
    <section class="sec">
      <h2 class="sec__title">{section.title}</h2>
      <ul class="plist">
        {#each visible as pid (pid)}
          {@const p = model.byId.get(pid)}
          {#if p}
            <li class="pitem">
              <a class="pitem__main" href="{base}/p/{p.id}">
                <span class="pitem__id">{p.id}</span>
                <span class="pitem__title">{p.title}</span>
              </a>
              <GospelPresence present={model.gospelsPresent(p)} />
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}
{/each}

<style>
  .filter {
    width: 100%;
    padding: 0.6rem 0.8rem;
    margin: 0.5rem 0 1.5rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--fg);
    font: inherit;
  }
  .sec { margin-bottom: 1.5rem; }
  .sec__title { font-size: 1.05rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3rem; }
  .plist { list-style: none; padding: 0; margin: 0; }
  .pitem {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.25rem;
    border-bottom: 1px solid var(--border);
  }
  .pitem__main { display: flex; gap: 0.6rem; align-items: baseline; flex: 1; min-width: 0; }
  .pitem__id { color: var(--fg-muted); font-variant-numeric: tabular-nums; min-width: 2.5rem; }
  .pitem__title { color: var(--fg); }
</style>
```

- [ ] **Step 2: Verify typecheck, dev render, commit**

Run: `pnpm --filter web typecheck` → 0 errors.
Run: `pnpm --filter web dev`, open the site, confirm the contents list renders with sections, filtering by `12` narrows results, console clean. Stop the dev server.

```bash
git add apps/web/src/routes/+page.svelte
git commit -m "feat(web): contents page with filter and gospel-presence chips"
```

---

### Task 14: Pericope page (`/p/[id]`)

Prerenders every pericope (and alias) id. Renders title/place/headnote, columns (or tabs), parallels, prev/next pager, breadcrumbs, and handles a verse deep-link via the URL hash (`/p/21#mt-3-13`).

**Files:**
- Create: `apps/web/src/routes/p/[id]/+page.ts`
- Create: `apps/web/src/routes/p/[id]/+page.svelte`

- [ ] **Step 1: Create `apps/web/src/routes/p/[id]/+page.ts`**

```ts
import { error } from '@sveltejs/kit';
import ids from '$lib/generated/pericope-ids.json';
import { loadSynopsis } from '$lib/data/synopsis.js';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => (ids as string[]).map((id) => ({ id }));

export const load: PageLoad = async ({ params, fetch }) => {
  const model = await loadSynopsis(fetch);
  const resolvedId = model.resolveId(params.id);
  const pericope = model.byId.get(resolvedId);
  if (!pericope) throw error(404, `Перикопа ${params.id} не найдена`);

  const order = model.raw.pericopes;
  const idx = order.findIndex((p) => p.id === pericope.id);
  const prevId = idx > 0 ? order[idx - 1]!.id : undefined;
  const nextId = idx >= 0 && idx < order.length - 1 ? order[idx + 1]!.id : undefined;

  return {
    pericope,
    present: model.gospelsPresent(pericope),
    section: model.sectionOf(pericope.id),
    prevId,
    nextId
  };
};
```

- [ ] **Step 2: Create `apps/web/src/routes/p/[id]/+page.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Pager from '$lib/components/Pager.svelte';
  import PericopeColumns from '$lib/components/PericopeColumns.svelte';
  import { reading } from '$lib/stores/reading.svelte.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const p = $derived(data.pericope);

  // remember reading position
  $effect(() => {
    reading.set({ id: p.id, title: p.title });
  });

  // deep-link to a verse via hash: #mt-3-13
  onMount(() => {
    function scrollToHash() {
      const hash = location.hash.replace(/^#/, '');
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('deep-target');
        setTimeout(() => el.classList.remove('deep-target'), 2000);
      }
    }
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  });
</script>

<svelte:head><title>{p.id}. {p.title}</title></svelte:head>

<Breadcrumbs section={data.section} current="{p.id}. {p.title}" />

<header class="phead">
  <h1>{p.id}. {p.title}</h1>
  {#if p.place}<p class="place">{p.place}</p>{/if}
  {#if p.headnote}<p class="headnote">{p.headnote}</p>{/if}
</header>

<PericopeColumns pericope={p} present={data.present} />

{#if p.extra}
  <section class="extra">
    <h2>{p.extra.source}</h2>
    <p class="flow">
      {#each p.extra.items as v, i (i)}
        <span class="verse-text"><sup class="vnum">{v.v}{v.suf}</sup> {v.t}</span>{' '}
      {/each}
    </p>
  </section>
{/if}

<Pager prevId={data.prevId} nextId={data.nextId} />

<style>
  .phead { margin-bottom: 1rem; }
  .phead h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
  .place { color: var(--fg-muted); font-style: italic; margin: 0 0 0.5rem; }
  .headnote { background: var(--bg-soft); padding: 0.5rem 0.75rem; border-radius: 6px; }
  .extra { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); }
  .vnum { color: var(--fg-muted); font-weight: 600; }
  :global(.deep-target) { background: var(--highlight); border-radius: 3px; transition: background 0.4s; }
</style>
```

- [ ] **Step 3: Typecheck and dev verification**

Run: `pnpm --filter web typecheck` → 0 errors.
Run: `pnpm --filter web dev`, then in the browser verify:
- `/p/12` — single Лука column, verses numbered.
- `/p/21` — Мф+Мк+Лк columns + a Ин fragment; both prev and next reflinks present and clickable; ‹/› and arrow keys page.
- `/p/51.1` — Мф ch.5 (vv. 1–12) and Лк ch.6 side by side, **numbered verses (not notes)**.
- Hover a verse with a parallel → its row highlights across columns (when highlight setting on).
- `/p/99.9` redirects/render to the `99.8` content (alias).
- Console clean. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/p/[id]/+page.ts apps/web/src/routes/p/[id]/+page.svelte
git commit -m "feat(web): pericope page with columns, parallels, paging, deep-links"
```

---

### Task 15: PericopeColumns component test (browser project)

Verifies the spec-critical behavior: verses render with numbers, notes render without numbers, and 51.1 shows numbered verses.

**Files:**
- Create: `apps/web/src/lib/components/PericopeColumns.svelte.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import PericopeColumns from './PericopeColumns.svelte';
import type { Pericope } from '@synopsis/schema';

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
  it('renders numbered verses and unnumbered notes', async () => {
    const screen = render(PericopeColumns, { pericope, present: ['mt', 'lk'] });
    await expect.element(screen.getByText('Блаженны нищие духом')).toBeInTheDocument();
    await expect.element(screen.getByText('примечание редактора')).toBeInTheDocument();
    // verse number visible for the verse
    await expect.element(screen.getByText('3', { exact: true })).toBeInTheDocument();
    // two gospel columns present
    await expect.element(screen.getByText('Матфей')).toBeInTheDocument();
    await expect.element(screen.getByText('Лука')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the browser-project test**

Run: `pnpm --filter web exec vitest run --project client`
Expected: PASS. The first run downloads the Chromium browser for the Playwright provider; if it fails with "browser not installed", run `pnpm --filter web exec playwright install chromium` and retry.

- [ ] **Step 3: Run the full vitest suite (both projects)**

Run: `pnpm --filter web test`
Expected: all node-project logic tests + the client-project component test PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/components/PericopeColumns.svelte.test.ts
git commit -m "test(web): PericopeColumns renders numbered verses and notes"
```

---

### Task 16: Prerender build verification

**Files:** none (verification + CI wiring)

- [ ] **Step 1: Full static build**

Run: `pnpm --filter web build`
Expected: build succeeds; output in `apps/web/build/`. Confirm prerendered HTML exists for sample routes:
Run: `node -e "for (const f of ['index.html','p/12.html','p/21.html','p/51.1.html','p/99.9.html']) console.log(f, require('fs').existsSync('apps/web/build/'+f))"`
Expected: each prints `true`. (If `p/51.1.html` is nested as `p/51.1/index.html`, accept either form — confirm the file exists.)

- [ ] **Step 2: Preview the static output**

Run: `pnpm --filter web preview`, open the served URL, confirm `/p/21` renders from the static build with a clean console. Stop preview.

- [ ] **Step 3: Extend CI with a web job**

Add a `web` job to `.github/workflows/ci.yml` (after the existing `schema` job, same `jobs:` map):

```yaml
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: Install Playwright browser
        run: pnpm --filter web exec playwright install --with-deps chromium
      - name: Typecheck web
        run: pnpm --filter web typecheck
      - name: Test web
        run: pnpm --filter web test
      - name: Build web
        run: pnpm --filter web build
```

- [ ] **Step 4: Verify the full local sequence and commit**

Run:
```bash
pnpm install --frozen-lockfile
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```
Expected: all green.

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck, test, and static build for the web app"
```

---

## Self-Review

**1. Spec coverage (Plan 2A scope):**
- SvelteKit + Svelte 5 runes, TS strict, adapter-static, full prerender → Tasks 1, 10, 14, 16. ✓
- Routes from `synopsis.json` at build (`entries()`) → Task 14 (+ Task 2 id list). ✓
- State in rune stores over one persistence module → Tasks 8, 9. ✓
- Scoped CSS + CSS variables for light/sepia/dark → Task 3 + component `<style>` blocks. ✓
- Content from typed data via components, no `innerHTML` → Tasks 11–14. ✓
- Contents page: sections, filter (number/title/place), presence indicators → Task 13. ✓
- Pericope page: present-only equal columns; mobile tabs ≤760px; parallel highlight; prev/next links; ‹/› + arrow paging; breadcrumbs; nested-id pages; verse deep-link → Tasks 12, 14. ✓
- Gospel labels from the case table → Task 4. ✓
- Acceptance: 12, 21, 51.1 render; resolveRef Мф 3:13→21 and Мф 5:3→51.1 (unit-tested) → Tasks 7, 14. ✓
- Adaptive 360px / themes persist → Task 3 + manual checks in Task 14 (full e2e for these is Plan 2B). ✓
- Deferred and explicitly out of scope: `/read`, search UI, `/prefaces` `/footnotes` `/appendix`, `/bookmarks` page, settings drawer UI, Playwright e2e → Plan 2B. ✓

**2. Placeholder scan:** No TBD/TODO. Every code step has complete content. The only "best-effort" notes are version-range and browser-install fallbacks, which include concrete recovery commands. ✓

**3. Type/name consistency:** `buildAlignmentMap`/`verseKey` (Task 5) used in Task 12; `parseRef`/`ParsedRef` (Task 6) used by `resolveRef` (Task 7); `buildModel`/`loadSynopsis`/`SynopsisModel` (Task 7) used in layout (10) and pericope load (14); `readJSON`/`writeJSON` (Task 8) used by all stores (Task 9); `SettingsStore`/`settings`/`bookmarks`/`reading` (Task 9) used in layout (10), columns (12), pericope (14); `GOSPEL_LABELS`/`gospelHeading` (Task 4) used in components (11, 12); generated `pericope-ids.json` (Task 2) consumed by `entries()` (Task 14); `synopsis:settings` key matches between `app.html` script (Task 1), the persist prefix (Task 8), and the settings key (Task 9). ✓

**Notes for executor:**
- This repo runs CI without a remote yet; "CI green" means the steps pass locally until a remote exists.
- The pericope page reads the verse anchor from `location.hash` inside `onMount` (no `$app/stores`/`$app/state` dependency needed), keeping the deep-link logic framework-version-agnostic.
