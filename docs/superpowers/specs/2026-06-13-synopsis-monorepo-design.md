# Евангельский синопсис — перепись в современный монорепозиторий

**Дата:** 2026-06-13
**Статус:** утверждён, переходим к плану реализации

## Цель

Переписать ридер «Евангельский синопсис» (параллельное четвероевангелие,
Синодальный перевод) как чистый pnpm-монорепозиторий. Старый ванильный SPA
(`site/app.js`, рендер через `innerHTML`, hash-роутинг, без типов/тестов/сборки)
выбрасываем. **Python-парсер (pdfplumber) и формат `data/synopsis.json`
сохраняем как контракт.**

## Исходное состояние (проверено)

- `data/synopsis.json`: 253 перикопы, 17 разделов, 2 предисловия, 23 примечания,
  `appendix2` = 1677 строк × 5 колонок, `gospelIndex` mt/mk/lk/jn = 165/108/176/66.
- `parser/parse_pdf.py`: один файл ~1046 строк, pdfplumber 0.11.9, читает корневой
  PDF → `data/synopsis.json` + `data/parse_report.txt`. Сверяется с поисковыми
  таблицами (эталон), текущих расхождений 19/~6000 (Страсти/Воскресение,
  родословия) — текст не теряется.
- `site/`: `index.html` + `assets/app.js` (hash-роутер: home/toc, `/p`, `/read`,
  prefaces, appendix, footnotes, bookmarks) + `style.css`.
- Tooling: Node 20.19, npm 10.8 (pnpm нет — поднимаем через `corepack enable`),
  Python 3.14, pdfplumber установлен. **Git: коммитов ещё нет.**

## Решения (согласованы с пользователем)

| Вопрос | Решение |
|---|---|
| Стили | Scoped CSS в компонентах + CSS-переменные для тем (light/sepia/dark). Без UI-китов. |
| Поиск | Свой нормализованный индекс (zero-dep): нормализация ё→е/регистр/диакритика, инвертированный индекс по словам + подстрочный фолбэк. |
| Деплой | Vercel. `paths.base = process.env.BASE_PATH ?? ''` (по умолчанию корень; env-override сохраняем для гибкости). |
| Старый фронтенд | Удаляем в финале: первый коммит импортирует репо как есть, `site/` + `build_site.py` удаляются отдельным коммитом по достижении паритета. |

## Расхождение с Appendix A (важно)

Appendix A объявляет `alignment: z.array(AlignmentRow)` («всегда есть»). По факту
в `synopsis.json` `alignment === null` у **130/253** перикоп (массивом — у 123,
пустым массивом — ни разу). Литеральная `z.array(...)` уронила бы валидацию CI на
настоящем файле.

**Правка (единственная):** в `packages/schema` —
`alignment: z.array(AlignmentRow).nullable()`. Форму `synopsis.json` **не**
меняем. Загрузчик нормализует `null → []`, чтобы UI работал с одним типом.

Остальные формы Appendix A подтверждены фактическими данными и остаются без
изменений: `place` nullable (84 null), `gospelIndex[].pericope` nullable
(68/515 null), `footnotes[].n: string`, union `{v,suf,t} | {note}` (3747 стихов /
137 заметок), `prev`/`next` — ключи всегда присутствуют, значение nullable (279
ненулевых RefLink формы `{p,pRaw,ref}`), `headnote?` (5), `extra?` (2),
`appendix2.rows` — все ширины = 5.

## Архитектура

```
.
├─ apps/web/                      # SvelteKit, Svelte 5 runes, TS strict, adapter-static
│  ├─ src/
│  │  ├─ lib/
│  │  │  ├─ data/
│  │  │  │  ├─ synopsis.ts        # loadSynopsis(): валидация через schema + производные индексы
│  │  │  │  ├─ labels.ts          # реэкспорт GOSPEL_LABELS (падежи)
│  │  │  │  ├─ alignment.ts       # buildAlignmentMap(pericope) -> Map<verseKey, rowId>
│  │  │  │  ├─ refs.ts            # parseRef("Мф 5:3"); resolveRef -> {pid, anchor}
│  │  │  │  └─ search.ts          # buildIndex(synopsis), search(q)
│  │  │  ├─ stores/
│  │  │  │  ├─ persist.ts         # типизированный localStorage (SSR-safe, namespaced synopsis:*)
│  │  │  │  ├─ settings.svelte.ts # тема, размер шрифта, засечки, подсветка параллелей
│  │  │  │  ├─ bookmarks.svelte.ts
│  │  │  │  └─ reading.svelte.ts  # «продолжить чтение»
│  │  │  └─ components/           # презентационные, без innerHTML
│  │  │     ├─ PericopeColumns.svelte / VerseItem.svelte / NoteItem.svelte
│  │  │     ├─ ColumnTabs.svelte   # ≤760px переключение по Евангелиям
│  │  │     ├─ RefLinkBadge.svelte # ранее/далее
│  │  │     ├─ SettingsDrawer.svelte # focus-trap, корректные слои скрим/панель
│  │  │     ├─ SearchBox.svelte / SearchResults.svelte
│  │  │     ├─ ScrollTable.svelte  # overflow-x контейнер для хронологии
│  │  │     └─ Breadcrumbs.svelte / Pager.svelte / GospelPresence.svelte
│  │  └─ routes/
│  ├─ svelte.config.js / vite.config.ts / playwright.config.ts
│  └─ static/data/synopsis.json   # копия из data/ на prebuild
├─ packages/schema/
│  ├─ src/synopsis.ts             # Appendix A + правка alignment
│  ├─ scripts/validate.ts         # CI: data/synopsis.json против схемы
│  ├─ scripts/gen-jsonschema.ts   # synopsis.schema.json
│  └─ synopsis.schema.json
├─ parser/parse_pdf.py + pyproject.toml   # ruff + mypy + pytest
├─ data/synopsis.json + parse_report.txt
├─ pnpm-workspace.yaml, package.json, tsconfig.base.json
└─ .github/workflows/ci.yml
```

`apps/web` зависит от `@synopsis/schema` как workspace-пакета.

## Доменная модель и загрузка

- `loadSynopsis()`: фетч `/data/synopsis.json` → `Synopsis.parse` (бросает при
  несовпадении формы) → производные индексы один раз: `pericopeById`,
  `sectionByPericope`, `aliasResolve(id)`, `gospelPresence(pericope)`, обратная
  карта «ссылка → перикопа» **по `columns`** (не по `gospelIndex`: там `pericope`
  бывает null).
- `buildAlignmentMap(pericope)`: из `alignment[]` строит `Map` ключа стиха
  (`"mt-3-13"`) → id строки-параллели, сопоставляя `segment.chapter + item.v(+suf)`.
  Чистая функция → юнит-тест.
- `GOSPEL_LABELS` — единственный источник падежных подписей колонок
  («Евангелие от Луки», без конкатенации).

## Состояние и персистентность

Один модуль `persist.ts` (типизированный, namespaced `synopsis:*`, на сервере
no-op, инициализация в `$effect`/`onMount`). Поверх — рун-сторы:
- `settings`: `theme` (light/sepia/dark), `fontSize`, `serif`,
  `highlightParallels` → применяются через `data-theme` + CSS-переменные на `<html>`.
- `bookmarks`: массив id перикоп.
- `reading`: последняя перикопа + якорь.

## Маршруты (все prerender)

| Route | Назначение |
|---|---|
| `/` | Содержание: `sections`, фильтр по номеру/названию/ссылке, индикаторы наличия Евангелий |
| `/p/[id]` | Перикопа: колонки/вкладки, подсветка параллелей, ранее/далее, листание ‹/› + стрелки, крошки, прогресс, подпункты-якоря (51.1…), deep-link к стиху |
| `/read/[g]` | Чтение одного Евангелия подряд (главы, метки перикоп, дедуп повторов) |
| `/search` | Поиск (полнотекст + разбор ссылки) |
| `/prefaces`, `/footnotes`, `/appendix` | Предисловия, примечания, хронология (в `ScrollTable`) |
| `/bookmarks` | Закладки |

Prerender: `+layout.ts` → `export const prerender = true`. Для `/p/[id]` —
`export const entries` отдаёт **все id, включая подпункты и алиасы**, из
`synopsis.json` на этапе сборки; `/read/[g]` — 4 ключа. `adapter-static`,
`base` из `BASE_PATH` (по умолчанию `''`).

**Deep-link к стиху** (`/p/21/mt-3-13`) реализуем как anchor/query в рамках
`/p/[id]` (скролл + подсветка на клиенте в `$effect`), а **не** как отдельный
prerender-маршрут `/p/[id]/[target]` — чтобы не плодить статические страницы.

## Уроки старой версии (учтены)

- **SettingsDrawer**: настоящая модалка — скрим и панель в правильном
  порядке/слоях, скрим не перехватывает клики по панели; focus-trap, `Esc`,
  возврат фокуса, `role="dialog"` + `aria-modal`.
- **Хронология**: таблица в `ScrollTable` (`overflow-x:auto`, `max-width:100%`),
  страница по горизонтали не разъезжается на 360–390px.
- Подписи Евангелий — из таблицы падежных форм.
- Контент — только из типизированных данных через компоненты; экранирование
  делает Svelte автоматически, `innerHTML` не используем.

## Поиск и разбор ссылок

- `parseRef`: таблица аббревиатур (`Мф/Мф./Матфей`, `Мк`, `Лк`, `Ин`),
  разделители `:`/`.`/пробел, диапазоны → `{gospel, chapter, verse}`;
  `resolveRef` ищет перикопу по `columns` → `{pid, anchor}`.
- `search`: нормализация (ё→е, нижний регистр, без знаков), инвертированный
  индекс по словам + подстрочный фолбэк; результат — стих со ссылкой и id
  перикопы. Строится на клиенте при загрузке.

## Тестирование и CI

- **Vitest юниты**: `parseRef`/`resolveRef`, `buildAlignmentMap`, `search`.
- **Component-tests**: PericopeColumns (стих vs заметка), SettingsDrawer (клик по
  панели не закрывает; скрим закрывает; focus-trap).
- **Playwright e2e** = критерии приёмки (см. ниже).
- **pytest** парсера: эталонные перикопы 12/21/51.1 — снапшот-сравнение с текущим
  `data/synopsis.json` (типизация/чистка не меняют вывод).
- **CI** `.github/workflows/ci.yml`: install → lint (ESLint+Prettier+svelte-check;
  ruff+mypy) → typecheck (tsc strict) → test (vitest+pytest) → валидация
  `data/synopsis.json` против JSON Schema → build. Падение схемы = красный CI.

## Перенос парсера

`parse_pdf.py` уже в `parser/`. Шаги без изменения вывода: зафиксировать эталон
(текущий `synopsis.json`) → `pyproject.toml` (ruff/mypy/pytest) → постепенная
типизация → pytest-снапшоты 12/21/51.1 → чистка распознавания стихов только при
зелёных снапшотах. README: `python parser/parse_pdf.py` → `data/synopsis.json`,
фронт читает этот файл (копируется в `static/data` на prebuild).

## Критерии приёмки (проверяемые)

- `pnpm dev` поднимает сайт, консоль чиста.
- Перикопа **12** (только Лк) и **21** (Мф+Мк+Лк + фрагмент Ин, двусторонние
  ранее/далее) рендерятся корректно.
- Перикопа **51.1 «Заповеди блаженства»**: Мф гл.5 (стихи 1–12) и Лк гл.6
  параллельно, с нумерацией стихов (не «заметками»).
- Поиск ссылки **`Мф 3:13`** → перикопа 21 + скролл к стиху; **`Мф 5:3`** → 51.1.
- Полнотекст **«Агнец Божий»** находит Ин 1:29 и 1:36.
- На 390px колонки → вкладки; таблица хронологии скроллится, страница по
  горизонтали не разъезжается.
- Темы/размер/засечки/подсветка переключаются и сохраняются между перезагрузками.
- Все страницы перикоп пререндерятся (статика, без серверного рантайма).
- CI зелёный (lint + typecheck + tests + build + валидация JSON-схемы).

## Порядок реализации (инкрементально)

1. Git: первый коммит = импорт текущего репо как есть. Каркас монорепо +
   `packages/schema` + валидация данных (зелёный CI на схеме сразу).
2. `apps/web` каркас: загрузчик + сторы + темы + layout/prerender.
3. Содержание `/` → перикопа `/p/[id]` (колонки, параллели, ранее/далее,
   листание) — проверка п.12/21/51.1 в браузере + моб. ширина.
4. Reader `/read/[g]`, поиск, предисловия/примечания/хронология, закладки,
   настройки-drawer.
5. e2e + парсер pytest/типизация. Зелёный CI.
6. Удаление `site/` + `build_site.py` отдельным коммитом по достижении паритета.
