# Plan 1 — Foundation: Monorepo + Schema Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo skeleton and the `@synopsis/schema` package — the single source of truth for the `synopsis.json` contract — with data validation, JSON Schema generation, and a green CI that fails if the real data stops matching the schema.

**Architecture:** pnpm workspace with `packages/schema` (Zod schema → inferred TS types + generated JSON Schema). The schema mirrors Appendix A of the spec verbatim, with one deviation forced by the real data: `alignment` is `.nullable()` (null in 130/253 pericopes). Scripts run via `tsx`; tests via Vitest. CI installs, typechecks, tests, validates `data/synopsis.json` against the schema, and checks the committed JSON Schema is current.

**Tech Stack:** pnpm 9 (via corepack), TypeScript 5 strict, Zod 3, zod-to-json-schema, tsx, Vitest, GitHub Actions.

---

## File Structure (locked in this plan)

- `.gitignore` — ignore node_modules, build outputs, caches, Python artifacts.
- `package.json` (root) — workspace scripts, `packageManager: pnpm`, prettier.
- `pnpm-workspace.yaml` — globs `apps/*`, `packages/*`.
- `tsconfig.base.json` — strict compiler base, extended by every TS project.
- `packages/schema/package.json` — `@synopsis/schema`, scripts, deps.
- `packages/schema/tsconfig.json` — extends base, `noEmit` typecheck.
- `packages/schema/src/synopsis.ts` — Zod contract + inferred types + `parseSynopsis`. **The single source of truth.**
- `packages/schema/test/synopsis.test.ts` — real-data-parses + negative tests.
- `packages/schema/scripts/validate.ts` — validates `data/synopsis.json`, used by CI.
- `packages/schema/scripts/gen-jsonschema.ts` — writes `packages/schema/synopsis.schema.json`.
- `packages/schema/synopsis.schema.json` — generated artifact, committed.
- `.github/workflows/ci.yml` — install → typecheck → test → validate data → schema-drift check.

All script/test paths to the data file resolve relative to the file via
`new URL(...)`, so they work regardless of the process working directory.

---

### Task 1: Add .gitignore and import the existing project as the first code commit

Repo currently has exactly one commit (the design spec). This task commits the
existing source (README, parser, data, legacy site, PDF) as-is so later work has
a clean baseline to diff against. The legacy `site/` is removed in Plan 2, not here.

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
build/
dist/
.svelte-kit/
.vercel/
.output/

# Test / coverage
coverage/
playwright-report/
test-results/

# Python
__pycache__/
*.pyc
.venv/
.mypy_cache/
.ruff_cache/
.pytest_cache/

# Editor / OS
.DS_Store
*.log
.idea/
```

- [ ] **Step 2: Stage and commit the existing project**

Run from the repo root:

```bash
git add .gitignore README.md build_site.py parser/ data/ site/ "Евангельский синопсис.gen.pdf"
git status --short
```

Expected: `.gitignore`, README.md, build_site.py, the parser, data, site, and the
PDF are staged; `parser/__pycache__/` is NOT staged (gitignored).

```bash
git commit -m "chore: import existing parser, data, and legacy site as baseline"
```

- [ ] **Step 3: Verify**

Run: `git log --oneline`
Expected: two commits — the import commit on top of `docs: design spec ...`.

---

### Task 2: Initialize the pnpm workspace root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Enable pnpm via corepack**

Run: `corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm --version`
Expected: prints `9.15.0`.

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "synopsis-monorepo",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "validate:data": "pnpm --filter @synopsis/schema validate",
    "gen:schema": "pnpm --filter @synopsis/schema gen:schema",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "prettier": "^3.4.2"
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json
git commit -m "chore: initialize pnpm workspace root with strict tsconfig base"
```

---

### Task 3: Scaffold the `@synopsis/schema` package

**Files:**
- Create: `packages/schema/package.json`
- Create: `packages/schema/tsconfig.json`

- [ ] **Step 1: Create `packages/schema/package.json`**

The package ships TypeScript source directly; the Vite-based web app transpiles it.

```json
{
  "name": "@synopsis/schema",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/synopsis.ts"
  },
  "types": "./src/synopsis.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "prettier --check \"src/**/*.ts\" \"scripts/**/*.ts\" \"test/**/*.ts\"",
    "validate": "tsx scripts/validate.ts",
    "gen:schema": "tsx scripts/gen-jsonschema.ts"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8",
    "zod-to-json-schema": "^3.24.1"
  }
}
```

- [ ] **Step 2: Create `packages/schema/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm install`
Expected: completes; `node_modules` created at root and resolves `@synopsis/schema`.

- [ ] **Step 4: Commit**

```bash
git add packages/schema/package.json packages/schema/tsconfig.json package.json pnpm-lock.yaml
git commit -m "chore(schema): scaffold @synopsis/schema package"
```

---

### Task 4: Write the Zod contract (`src/synopsis.ts`)

Appendix A of the spec verbatim, with the one data-forced deviation:
`alignment` is `.nullable()`.

**Files:**
- Create: `packages/schema/src/synopsis.ts`

- [ ] **Step 1: Create `packages/schema/src/synopsis.ts`**

```ts
import { z } from 'zod';

export const GOSPELS = ['mt', 'mk', 'lk', 'jn'] as const;
export type GospelKey = (typeof GOSPELS)[number];

/** Падежные формы для подписей колонок (НЕ конкатенировать имя + "а"). */
export const GOSPEL_LABELS: Record<GospelKey, { abbr: string; nom: string; gen: string }> = {
  mt: { abbr: 'Мф', nom: 'Матфей', gen: 'Матфея' },
  mk: { abbr: 'Мк', nom: 'Марк', gen: 'Марка' },
  lk: { abbr: 'Лк', nom: 'Лука', gen: 'Луки' },
  jn: { abbr: 'Ин', nom: 'Иоанн', gen: 'Иоанна' },
};

/** Ссылка «ранее/далее» на сегменте колонки. */
export const RefLink = z.object({
  ref: z.string(), // "3:21–22"
  p: z.string(), // id перикопы-цели: "21"
  pRaw: z.string(), // исходная строка номера из PDF
});
export type RefLink = z.infer<typeof RefLink>;

/** Элемент колонки — либо стих, либо заметка (взаимоисключающие формы). */
export const VerseItem = z.object({
  v: z.number().int(), // номер стиха
  suf: z.string(), // "", "а", "б", "ба", "аб"
  t: z.string(), // текст стиха
});
export type VerseItem = z.infer<typeof VerseItem>;

export const NoteItem = z.object({ note: z.string() });
export type NoteItem = z.infer<typeof NoteItem>;

export const ColumnItem = z.union([VerseItem, NoteItem]);
export type ColumnItem = z.infer<typeof ColumnItem>;
export const isVerse = (i: ColumnItem): i is VerseItem => 'v' in i;

export const Segment = z.object({
  gospel: z.enum(GOSPELS),
  chapter: z.number().int(),
  prev: RefLink.nullable(), // ключ всегда есть, значение может быть null
  next: RefLink.nullable(),
  items: z.array(ColumnItem),
});
export type Segment = z.infer<typeof Segment>;

export const Column = z.object({ segments: z.array(Segment) });
export type Column = z.infer<typeof Column>;

/** Строка параллелей: любые из 4 ключей -> "глава:стих" ("3:13"). */
export const AlignmentRow = z
  .object({
    mt: z.string().optional(),
    mk: z.string().optional(),
    lk: z.string().optional(),
    jn: z.string().optional(),
  })
  .strict();
export type AlignmentRow = z.infer<typeof AlignmentRow>;

/** Доп. источник (напр. «1Кор.15» в перикопе о Воскресении). */
export const Extra = z.object({
  source: z.string(),
  items: z.array(VerseItem),
});
export type Extra = z.infer<typeof Extra>;

export const Pericope = z.object({
  id: z.string(), // "21", "51.1", "99.8"
  title: z.string(),
  place: z.string().nullable(), // место/датировка или null
  pages: z.array(z.number().int()), // страницы PDF-источника
  order: z.number().int(), // порядок следования
  columns: z.object({
    mt: Column.nullable(),
    mk: Column.nullable(),
    lk: Column.nullable(),
    jn: Column.nullable(),
  }),
  // DEVIATION FROM SPEC APPENDIX A: alignment is null in 130/253 pericopes in the
  // real data (array in 123, empty array never). Appendix A declared a bare array;
  // making it nullable is required so the actual data validates in CI.
  alignment: z.array(AlignmentRow).nullable(),
  headnote: z.string().optional(), // редкая вводная заметка
  extra: Extra.optional(),
});
export type Pericope = z.infer<typeof Pericope>;

export const Section = z.object({
  id: z.number().int(),
  title: z.string(),
  pericopeIds: z.array(z.string()),
});
export type Section = z.infer<typeof Section>;

export const GospelIndexEntry = z.object({
  ref: z.string(), // "1:1–17", "5:1–8:1"
  pericope: z.string().nullable(), // часть строк указателя пока null
  title: z.string(),
  np: z.boolean(), // относится к Нагорной проповеди
});
export type GospelIndexEntry = z.infer<typeof GospelIndexEntry>;

export const Synopsis = z.object({
  meta: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    source: z.string().optional(),
  }),
  sections: z.array(Section),
  pericopes: z.array(Pericope),
  gospelIndex: z.object({
    mt: z.array(GospelIndexEntry),
    mk: z.array(GospelIndexEntry),
    lk: z.array(GospelIndexEntry),
    jn: z.array(GospelIndexEntry),
  }),
  prefaces: z.array(z.object({ title: z.string(), paragraphs: z.array(z.string()) })),
  footnotes: z.array(
    z.object({ n: z.string(), text: z.string() }), // n — строка ("1"), не число
  ),
  appendix2: z.object({
    title: z.string(),
    intro: z.array(z.string()),
    columns: z.array(z.string()), // заголовки столбцов таблицы хронологий
    rows: z.array(z.array(z.string())), // строки одинаковой длины с columns
  }),
  aliases: z.record(z.string(), z.string()), // {"99.9":"99.8"}
});
export type Synopsis = z.infer<typeof Synopsis>;

/** Бросает ZodError, если форма не совпала. Использовать в загрузчике и в CI. */
export function parseSynopsis(data: unknown): Synopsis {
  return Synopsis.parse(data);
}
```

- [ ] **Step 2: Typecheck the package**

Run: `pnpm --filter @synopsis/schema typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/schema/src/synopsis.ts
git commit -m "feat(schema): Zod contract for synopsis.json (alignment nullable per real data)"
```

---

### Task 5: Test that the real data validates (and malformed data fails)

**Files:**
- Create: `packages/schema/test/synopsis.test.ts`

- [ ] **Step 1: Write the failing test**

The test loads the actual `data/synopsis.json` (resolved relative to this file)
and asserts it validates, then asserts a malformed object is rejected.

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Synopsis, parseSynopsis } from '../src/synopsis.js';

const dataUrl = new URL('../../../data/synopsis.json', import.meta.url);
const raw: unknown = JSON.parse(readFileSync(dataUrl, 'utf8'));

describe('Synopsis schema vs real data', () => {
  it('validates the real data/synopsis.json', () => {
    const result = Synopsis.safeParse(raw);
    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues.slice(0, 5), null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('exposes the expected top-level counts', () => {
    const data = parseSynopsis(raw);
    expect(data.pericopes.length).toBe(253);
    expect(data.sections.length).toBe(17);
    expect(data.appendix2.rows.every((r) => r.length === data.appendix2.columns.length)).toBe(true);
  });

  it('accepts a pericope with alignment === null', () => {
    const data = parseSynopsis(raw);
    expect(data.pericopes.some((p) => p.alignment === null)).toBe(true);
  });

  it('rejects malformed data (footnotes.n must be a string)', () => {
    const bad = JSON.parse(JSON.stringify(raw)) as { footnotes: { n: unknown }[] };
    bad.footnotes[0].n = 1; // number, not string
    expect(Synopsis.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm the harness works and it fails if `.js` import is wrong**

Run: `pnpm --filter @synopsis/schema test`
Expected: tests run. They should PASS (the schema matches the verified data). If the
real-data test fails, the printed Zod issues show the exact mismatch — fix the
schema, not the data. The malformed-data test guards against accidental loosening.

- [ ] **Step 3: Commit**

```bash
git add packages/schema/test/synopsis.test.ts
git commit -m "test(schema): real synopsis.json validates; malformed data rejected"
```

---

### Task 6: Validation script for CI

**Files:**
- Create: `packages/schema/scripts/validate.ts`

- [ ] **Step 1: Create `packages/schema/scripts/validate.ts`**

```ts
import { readFileSync } from 'node:fs';
import { Synopsis } from '../src/synopsis.js';

const dataUrl = new URL('../../../data/synopsis.json', import.meta.url);
const json: unknown = JSON.parse(readFileSync(dataUrl, 'utf8'));

const result = Synopsis.safeParse(json);
if (!result.success) {
  console.error(result.error.issues.slice(0, 20));
  process.exit(1);
}
console.log(`OK: ${result.data.pericopes.length} перикоп, схема валидна.`);
```

- [ ] **Step 2: Run the validator**

Run: `pnpm --filter @synopsis/schema validate`
Expected: prints `OK: 253 перикоп, схема валидна.` and exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/schema/scripts/validate.ts
git commit -m "feat(schema): CI validation script for data/synopsis.json"
```

---

### Task 7: Generate and commit the JSON Schema artifact

**Files:**
- Create: `packages/schema/scripts/gen-jsonschema.ts`
- Create: `packages/schema/synopsis.schema.json` (generated)

- [ ] **Step 1: Create `packages/schema/scripts/gen-jsonschema.ts`**

Writes the JSON Schema next to the package (path resolved relative to this file).

```ts
import { writeFileSync } from 'node:fs';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Synopsis } from '../src/synopsis.js';

const outUrl = new URL('../synopsis.schema.json', import.meta.url);
const schema = zodToJsonSchema(Synopsis, 'Synopsis');
writeFileSync(outUrl, JSON.stringify(schema, null, 2) + '\n');
console.log('Wrote packages/schema/synopsis.schema.json');
```

- [ ] **Step 2: Generate the schema**

Run: `pnpm --filter @synopsis/schema gen:schema`
Expected: prints `Wrote packages/schema/synopsis.schema.json`; the file exists and
contains a `"$ref": "#/definitions/Synopsis"` with a `definitions.Synopsis` object.

- [ ] **Step 3: Sanity-check the artifact**

Run: `node -e "const s=require('./packages/schema/synopsis.schema.json'); console.log(Object.keys(s.definitions))"`
Expected: lists `Synopsis` among the definitions.

- [ ] **Step 4: Commit**

```bash
git add packages/schema/scripts/gen-jsonschema.ts packages/schema/synopsis.schema.json
git commit -m "feat(schema): generate and commit JSON Schema artifact"
```

---

### Task 8: CI workflow (install → typecheck → test → validate → schema-drift)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

This is the Plan-1 CI; Plan 2 (web) and Plan 3 (parser) extend it with their own
jobs. The schema-drift step regenerates the JSON Schema and fails if the committed
artifact is stale.

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  schema:
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

      - name: Typecheck schema
        run: pnpm --filter @synopsis/schema typecheck

      - name: Test schema
        run: pnpm --filter @synopsis/schema test

      - name: Validate data against schema
        run: pnpm --filter @synopsis/schema validate

      - name: Check committed JSON Schema is current
        run: |
          pnpm --filter @synopsis/schema gen:schema
          git diff --exit-code -- packages/schema/synopsis.schema.json
```

- [ ] **Step 2: Verify the steps locally**

Run each CI step locally to confirm green before pushing:

```bash
pnpm install --frozen-lockfile
pnpm --filter @synopsis/schema typecheck
pnpm --filter @synopsis/schema test
pnpm --filter @synopsis/schema validate
pnpm --filter @synopsis/schema gen:schema && git diff --exit-code -- packages/schema/synopsis.schema.json
```

Expected: every command exits 0; the final `git diff` reports no changes.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: schema typecheck, tests, data validation, and JSON Schema drift check"
```

---

## Self-Review

**1. Spec coverage (Plan-1 scope only):**
- Monorepo skeleton (`pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`) → Task 2. ✓
- `packages/schema` as single source of truth (Zod → TS types) → Tasks 3–4. ✓
- `alignment` nullable deviation documented in code → Task 4. ✓
- JSON Schema export → Task 7. ✓
- CI data validation against schema (red on failure) → Tasks 6, 8. ✓
- Strict TypeScript everywhere → `tsconfig.base.json` (Task 2) + package typecheck (Task 4). ✓
- Legacy `site/` deletion is explicitly OUT of scope here (handled in Plan 2). ✓
- Web app, stores, routes, search, parser hardening → out of scope (Plans 2 and 3). ✓

**2. Placeholder scan:** No TBD/TODO/"add error handling"/"similar to". Every code step has complete content. ✓

**3. Type consistency:** `Synopsis`, `parseSynopsis`, `RefLink`, `VerseItem`, `NoteItem`, `Segment`, `Column`, `AlignmentRow`, `Pericope`, `Section`, `GospelIndexEntry`, `GOSPEL_LABELS`, `isVerse` are defined once in `src/synopsis.ts` (Task 4) and imported by name in the test (Task 5), validate script (Task 6), and gen script (Task 7). Imports use the `.js` extension (matching `verbatimModuleSyntax` + Bundler resolution of `.ts` source). ✓

**Note for executor:** If `pnpm install` resolves newer compatible minor/patch versions than pinned here, that is expected (`^` ranges). If a real-data validation failure surfaces in Task 5/6, the fix is always in the schema (or a documented deviation), never editing `data/synopsis.json`.
