# Евангельский синопсис

Четвероевангелие (Синодальный перевод) в параллельных столбцах по изданию
«Евангельский синопсис» (сост. свящ. А. Емельянов): 253 перикопы с подпунктами,
взаимные ссылки *ранее/далее*, поисковые таблицы, предисловия и приложения.

Монорепозиторий (pnpm workspace) из трёх частей:

1. **`parser/`** — Python-парсер (pdfplumber) извлекает структуру из
   `Евангельский синопсис.gen.pdf` в `data/synopsis.json`.
2. **`packages/schema/`** — единый контракт данных: Zod-схема `synopsis.json`,
   выведенные TS-типы и сгенерированная JSON Schema. Источник истины формата.
3. **`apps/web/`** — ридер на **SvelteKit + Svelte 5 (runes)**, TypeScript strict,
   `adapter-static` с полным prerender. Без серверного рантайма — чистая статика.

```
.
├─ apps/web/          # SvelteKit-ридер (prerender всех страниц)
├─ packages/schema/   # Zod-контракт synopsis.json -> TS-типы + JSON Schema
├─ parser/            # parse_pdf.py (pdfplumber) + pytest/ruff/mypy
├─ data/              # synopsis.json + parse_report.txt (артефакты парсера)
└─ Евангельский синопсис.gen.pdf
```

## Быстрый старт

```bash
corepack enable                 # включить pnpm
pnpm install

pnpm --filter web dev           # http://localhost:5173
pnpm --filter web build         # статика -> apps/web/build/
pnpm --filter web preview       # локальный просмотр сборки
```

`pnpm --filter web dev`/`build` сами копируют `data/synopsis.json` в
`apps/web/static/data/` (шаг `prepare-data`). Фронтенд читает этот файл в браузере;
бэкенд не нужен.

## Парсер: разработка

```bash
# окружение (ruff, mypy, pytest, pdfplumber)
python -m pip install -r parser/requirements-dev.txt

# перегенерировать данные из PDF
PYTHONIOENCODING=utf-8 python parser/parse_pdf.py   # -> data/synopsis.json (+ report)
python parser/parse_pdf.py 21                       # + печать перикопы 21 для отладки

# проверки (из каталога parser/)
cd parser
ruff check .            # линт
mypy parse_pdf.py       # типы (gradual)
python -m pytest -q     # golden-тест: вывод сверяется с data/synopsis.json
```

`PYTHONIOENCODING=utf-8` нужен только для корректного вывода кириллицы в консоль
(на сам JSON не влияет). Golden-тест (`parser/tests/test_golden.py`) разбирает PDF
заново и сверяет результат с зафиксированным `data/synopsis.json` (плюс контрольные
перикопы 12/21/51.1) — гарантия, что правки парсера не меняют вывод.

## Возможности ридера

- **Содержание** (`/`) с разделами, фильтром (номер/название/место) и индикаторами
  присутствия каждого Евангелия в перикопе; баннер «продолжить чтение».
- **Страница перикопы** (`/p/[id]`): столбцы только для присутствующих Евангелий,
  на мобильном (≤760px) — вкладки; подсветка параллельных стихов; кликабельные
  ссылки *ранее/далее*; листание ‹/› и стрелками; хлебные крошки; deep-link к стиху
  (`/p/21#mt-3-13`); закладка.
- **Чтение Евангелия** подряд (`/read/[g]`) с разметкой глав, метками перикоп и
  дедупликацией повторяющихся стихов.
- **Поиск** (`/search`): полнотекстовый по стихам **и** разбор ссылки (`Мф 5:3`,
  `Ин.1:29`) → переход к перикопе/стиху. Индекс строится на клиенте.
- **Предисловия** (`/prefaces`), **Примечания** (`/footnotes`), **Хронология**
  (`/appendix` — широкая таблица в горизонтальном скролл-контейнере).
- **Закладки** (`/bookmarks`), **настройки** (тема светлая/сепия/тёмная, размер
  шрифта, засечки, подсветка параллелей) — всё персистентно в `localStorage`.
- Адаптив от 360px, доступность (роли, фокус, навигация с клавиатуры).

## Качество и CI

- **TypeScript strict** везде; `packages/schema` — единый источник типов.
- **Тесты**: Vitest (юниты: разбор ссылок, карта параллелей, поисковый индекс,
  чтение; компонентные: колонки перикопы, drawer настроек), Playwright e2e на
  сценарии приёмки; pytest golden на парсер.
- **Валидация данных**: `data/synopsis.json` проверяется против Zod-схемы; JSON
  Schema коммитится и сверяется на дрейф.
- **CI** (GitHub Actions, `.github/workflows/ci.yml`): три задания — `schema`
  (typecheck + тесты + валидация данных + дрейф схемы), `web` (svelte-check +
  Vitest + build + Playwright), `parser` (ruff + mypy + pytest golden).

```bash
pnpm --filter @synopsis/schema test       # схема + валидация данных
pnpm --filter web test                    # Vitest (юнит + компонентные)
pnpm --filter web test:e2e                # Playwright
```

## Качество парсинга

Парсер сверяется с поисковыми таблицами в конце книги (эталон). Отчёт —
`data/parse_report.txt`. На текущий момент расхождений **22** (из ~6000 стихов),
сосредоточены в самых нерегулярных по вёрстке перикопах Страстей/Воскресения
(131, 143, 163, 165) и нескольких «вклеенных» в строку номерах родословия.
Во всех случаях **текст не теряется** — такие стихи попадают в примечания или в
соседний столбец. Контрольные перикопы 12 (только Лк) и 21 (Мф+Мк+Лк + фрагмент Ин)
разобраны верно.

## Деплой

Цель — **Vercel** как чистая статика (`adapter-static`, все страницы пререндерятся).
`pnpm --filter web build` → `apps/web/build/`. Базовый путь настраивается через
переменную `BASE_PATH` (по умолчанию пусто = корень домена); для деплоя в подпуть
(напр. GitHub Pages проекта) задайте `BASE_PATH=/repo` при сборке.

## Структура `data/synopsis.json`

Точный контракт — Zod-схема в `packages/schema/src/synopsis.ts` (источник истины
типов и JSON Schema).

```
meta        { title, subtitle?, source? }
sections    [ { id, title, pericopeIds[] } ]
pericopes   [ { id, title, place|null, pages[], order,
                columns: { mt|mk|lk|jn : null | { segments:[ {gospel,chapter,
                  prev|null, next|null, items:[ {v,suf,t} | {note} ] } ] } },
                alignment: [ { mt:"3:13", mk:"1:9", … } ] | null,   // параллели
                headnote?, extra? } ]
gospelIndex  { mt|mk|lk|jn : [ {ref, pericope|null, title, np} ] }   // поисковые таблицы
prefaces     [ {title, paragraphs[]} ]
footnotes    [ {n, text} ]
appendix2    { title, intro[], columns[], rows[][] }
aliases      { "99.9":"99.8" }
```

Примечание: `alignment` бывает `null` (≈130 перикоп из 253) — отсюда `nullable` в
схеме; загрузчик нормализует `null → []`.
