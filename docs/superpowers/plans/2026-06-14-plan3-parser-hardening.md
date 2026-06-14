# Plan 3 — Parser Hardening (pyproject, ruff, mypy, pytest golden)

> **For agentic workers:** Executed inline on `master`. Steps use checkbox (`- [ ]`) syntax. Independent of the web app. The non-negotiable invariant: **the parser's output must not change** — a golden regression test compares a fresh parse against the committed `data/synopsis.json`.

> **STATUS: COMPLETED 2026-06-14.** `data/synopsis.json` is byte-identical through all changes; 4 golden tests, ruff clean, mypy (gradual) clean. One extra commit beyond the plan: the imported `parse_report.txt` and README count (19) were stale relative to the committed parser, so they were synced to the real value (22 validation diffs) — the data contract was unaffected. Tools resolved: ruff 0.15, mypy 1.20, pytest 8.4 (local Python 3.14; CI uses 3.12).

**Goal:** Make the existing `parser/parse_pdf.py` maintainable and CI-guarded: a `pyproject.toml` with ruff + mypy + pytest config, a small testable seam (`build_data`) extracted from `main`, a golden regression test over the reference pericopes (12, 21, 51.1) plus full-output equality, lint (ruff) and type-check (mypy, gradual) green, and a Python CI job.

**Architecture:** `parse_pdf.py` keeps its logic untouched; only `main()` is split so the data-building is callable without writing files. Tests parse the real PDF once (module-scoped fixture) and assert the result equals the committed JSON. mypy runs in a deliberately lenient "gradual typing" mode (the file is legacy, ~1046 lines); ruff runs with safe autofixes and a few documented ignores so behavior is preserved.

**Tech Stack:** Python 3 (local 3.14), pdfplumber 0.11.x, pytest, ruff, mypy.

**Invariant guard:** after every change in this plan, `python -m pytest` (golden test) must stay green. If output changes, revert the change — typing/lint must not alter parser behavior.

---

## File Structure

```
parser/
├─ parse_pdf.py            # CHANGED: extract build_data(pdf) -> (data, problems)
├─ pyproject.toml          # ruff + mypy + pytest config
├─ requirements-dev.txt    # pdfplumber, pytest, ruff, mypy
└─ tests/
   ├─ conftest.py          # adds parser/ to sys.path; session-scoped parsed data
   └─ test_golden.py       # full-equality + per-pericope 12/21/51.1 assertions
.github/workflows/ci.yml   # CHANGED: + python job
README.md                  # CHANGED: parser dev commands
```

---

### Task 1: `pyproject.toml` + dev requirements

**Files:** Create `parser/pyproject.toml`, `parser/requirements-dev.txt`

- [ ] **Step 1: Create `parser/pyproject.toml`**

```toml
[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP"]
# Legacy parser: keep the original mixed-case constant name and allow a few patterns.
ignore = [
  "E501", # long verse-count tables are clearer on one line
  "N816", # GOSPel_ORDER: original constant name kept to avoid churn
  "E741"  # ambiguous single-letter loop vars (g, c) are domain-conventional
]

[tool.mypy]
python_version = "3.10"
ignore_missing_imports = true   # pdfplumber ships no stubs
disallow_untyped_defs = false   # gradual: legacy bodies stay unannotated
check_untyped_defs = false
warn_return_any = false
warn_unused_ignores = false

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 2: Create `parser/requirements-dev.txt`**

```
pdfplumber>=0.11,<0.12
pytest>=8,<9
ruff>=0.8,<1.0
mypy>=1.13,<2.0
```

- [ ] **Step 3: Verify tools are available locally**

Run: `python -m pytest --version && python -m ruff --version 2>/dev/null || ruff --version; mypy --version`
Expected: versions print. If `ruff`/`mypy`/`pytest` are missing locally, install: `python -m pip install -r parser/requirements-dev.txt`.

- [ ] **Step 4: Commit**

```bash
git add parser/pyproject.toml parser/requirements-dev.txt
git commit -m "build(parser): pyproject (ruff/mypy/pytest) and dev requirements"
```

---

### Task 2: Extract a testable `build_data` seam

Split data-building from file-writing so tests can parse without overwriting the golden. **Behavior must be identical.**

**Files:** Modify `parser/parse_pdf.py`

- [ ] **Step 1: Add `build_data` and slim `main`.** Replace the body of `main()` (currently lines ~997-1042) so that everything from opening the PDF through assembling `data` lives in `build_data(pdf)`, and `main()` opens the PDF, calls `build_data`, then writes files and prints. Concretely:

Add this function immediately above `def main():`

```python
def build_data(pdf):
    """Parse an open pdfplumber PDF into the synopsis data dict.

    Returns (data, problems). Pure w.r.t. the filesystem (writes nothing);
    main() handles output. Behavior is identical to the original main().
    """
    log("=== Разбор поисковых таблиц ===")
    gospel_index, expected_map = parse_index(pdf)
    for g in GOSPel_ORDER:
        log(f"  {KEY2ABBR[g]}: {len(gospel_index[g])} строк указателя")

    log("=== Разбор основного блока ===")
    sections, pericopes = parse_main(pdf, expected_map)
    log(f"  секций: {len(sections)}, перикоп: {len(pericopes)}")

    log("=== Сверка с указателем ===")
    problems = validate(pericopes, expected_map, gospel_index)
    log(f"  расхождений: {problems}")

    prefaces = parse_prefaces(pdf)
    footnotes = parse_footnotes(pdf)
    appendix2 = parse_appendix2(pdf)

    data = {
        "meta": {
            "title": "Евангельский синопсис",
            "subtitle": "Учебное пособие. Сост. свящ. А. Емельянов",
            "source": "Евангельский синопсис.gen.pdf",
        },
        "sections": sections,
        "pericopes": pericopes,
        "gospelIndex": gospel_index,
        "prefaces": prefaces,
        "footnotes": footnotes,
        "appendix2": appendix2,
        "aliases": PERICOPE_ALIASES,
    }
    return data, problems
```

Then replace `main()` with:

```python
def main():
    debug_ids = set(sys.argv[1:])
    pdf = pdfplumber.open(PDF_PATH)
    data, problems = build_data(pdf)
    pericopes = data["pericopes"]

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    print(f"OK: {len(pericopes)} pericopes -> {OUT_PATH}")
    print(f"report -> {REPORT_PATH} ({problems} validation diffs)")

    for pid in debug_ids:
        for p in pericopes:
            if p["id"] == pid:
                print(json.dumps(p, ensure_ascii=False, indent=1))
```

- [ ] **Step 2: Confirm the parser still produces identical output.** Regenerate and diff against the committed golden:

```bash
python parser/parse_pdf.py
git diff --stat -- data/synopsis.json
```
Expected: **no diff** to `data/synopsis.json` (the refactor preserved output). If there is a diff, the extraction changed call order — fix until the diff is empty, then restore the file with `git checkout -- data/synopsis.json` if the regen touched only formatting.

- [ ] **Step 3: Commit**

```bash
git add parser/parse_pdf.py
git commit -m "refactor(parser): extract build_data seam from main (output unchanged)"
```

---

### Task 3: Golden regression test

**Files:** Create `parser/tests/conftest.py`, `parser/tests/test_golden.py`

- [ ] **Step 1: Create `parser/tests/conftest.py`**

```python
import json
import os
import sys

import pdfplumber
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
PARSER_DIR = os.path.dirname(HERE)
ROOT = os.path.dirname(PARSER_DIR)
sys.path.insert(0, PARSER_DIR)

import parse_pdf  # noqa: E402


@pytest.fixture(scope="session")
def parsed():
    with pdfplumber.open(parse_pdf.PDF_PATH) as pdf:
        data, _problems = parse_pdf.build_data(pdf)
    return data


@pytest.fixture(scope="session")
def golden():
    with open(os.path.join(ROOT, "data", "synopsis.json"), encoding="utf-8") as f:
        return json.load(f)
```

- [ ] **Step 2: Create `parser/tests/test_golden.py`**

```python
def _by_id(data, pid):
    return next((p for p in data["pericopes"] if p["id"] == pid), None)


def test_full_output_matches_golden(parsed, golden):
    # A fresh parse must reproduce the committed data byte-for-byte (structurally).
    assert parsed == golden


def test_pericope_12_luke_only(parsed):
    p = _by_id(parsed, "12")
    assert p is not None
    assert p["columns"]["lk"] is not None
    assert p["columns"]["mt"] is None
    assert p["columns"]["mk"] is None
    assert p["columns"]["jn"] is None


def test_pericope_21_has_four_columns_with_links(parsed):
    p = _by_id(parsed, "21")
    assert p is not None
    for g in ("mt", "mk", "lk"):
        assert p["columns"][g] is not None
    assert p["columns"]["jn"] is not None  # John fragment
    # Luke segment carries both prev and next reference links
    lk_segs = p["columns"]["lk"]["segments"]
    assert any(seg["prev"] for seg in lk_segs)
    assert any(seg["next"] for seg in lk_segs)


def test_pericope_51_1_beatitudes_numbered(parsed):
    p = _by_id(parsed, "51.1")
    assert p is not None
    assert "блаженств" in p["title"].lower()
    mt = p["columns"]["mt"]
    assert mt is not None
    # Matthew chapter 5 with numbered verses (not notes)
    seg = next(s for s in mt["segments"] if s["chapter"] == 5)
    verses = [it for it in seg["items"] if "v" in it]
    assert len(verses) > 0
    assert any(it["v"] == 3 for it in verses)
    assert p["columns"]["lk"] is not None  # Luke 6 parallel present
```

- [ ] **Step 3: Run the tests**

Run: `cd parser && python -m pytest -q`
Expected: 4 passed. (The session fixture parses the PDF once; expect ~10-60s.) If `test_full_output_matches_golden` fails, the parse no longer matches the committed JSON — investigate the diff; do not edit the golden to match.

- [ ] **Step 4: Commit**

```bash
git add parser/tests/conftest.py parser/tests/test_golden.py
git commit -m "test(parser): golden regression (full output + pericopes 12/21/51.1)"
```

---

### Task 4: ruff lint green

**Files:** possibly modify `parser/parse_pdf.py` (safe autofixes only)

- [ ] **Step 1: Inspect lint findings**

Run: `cd parser && ruff check .`
Expected: a list of findings (likely unused imports, import order).

- [ ] **Step 2: Apply only safe autofixes**

Run: `cd parser && ruff check --fix .`
Then re-run the golden test: `python -m pytest -q`
Expected: tests still pass (autofixes must not change behavior). If any test fails, `git checkout -- parse_pdf.py` and fix lint manually/selectively.

- [ ] **Step 3: Resolve remaining findings** by tightening `ignore` in `pyproject.toml` for legacy-justified rules, or small manual edits (e.g., remove a genuinely unused variable). Re-run `ruff check .` until clean and `python -m pytest -q` until green.

- [ ] **Step 4: Commit**

```bash
git add parser/parse_pdf.py parser/pyproject.toml
git commit -m "style(parser): ruff clean (safe fixes; legacy-justified ignores)"
```

---

### Task 5: mypy (gradual) green

**Files:** Modify `parser/parse_pdf.py` (targeted annotations only)

- [ ] **Step 1: Run mypy**

Run: `cd parser && mypy parse_pdf.py`
Expected: with the lenient config, few or no errors. 

- [ ] **Step 2: Annotate the new seam and fix real errors.** Add a return annotation to `build_data`:

```python
def build_data(pdf) -> tuple[dict, int]:
```

Fix any genuine mypy errors with minimal, behavior-preserving edits or a narrowly-scoped `# type: ignore[code]` with a short reason. Do not broaden the lenient config further than necessary; do not add annotations that change runtime behavior.

- [ ] **Step 3: Verify and re-run tests**

Run: `cd parser && mypy parse_pdf.py && python -m pytest -q`
Expected: mypy clean, 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add parser/parse_pdf.py
git commit -m "types(parser): annotate build_data seam; mypy gradual green"
```

---

### Task 6: Python CI job

**Files:** Modify `.github/workflows/ci.yml`

- [ ] **Step 1: Add a `parser` job** (sibling of `schema` and `web`):

```yaml
  parser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install
        run: pip install -r parser/requirements-dev.txt
      - name: Lint (ruff)
        run: ruff check parser
      - name: Typecheck (mypy)
        run: mypy parser/parse_pdf.py
        working-directory: ${{ github.workspace }}
      - name: Test (pytest golden)
        run: python -m pytest -q
        working-directory: parser
```

- [ ] **Step 2: Sanity-check the YAML and commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: parser job (ruff, mypy, pytest golden)"
```

---

### Task 7: README parser dev docs

**Files:** Modify `README.md`

- [ ] **Step 1: Add a short "Parser development" section** documenting:

```
## Парсер: разработка

# окружение
python -m pip install -r parser/requirements-dev.txt

# перегенерировать данные из PDF
python parser/parse_pdf.py            # -> data/synopsis.json (+ parse_report.txt)
python parser/parse_pdf.py 21         # + распечатать перикопу 21 для отладки

# проверки (из каталога parser/)
cd parser && ruff check . && mypy parse_pdf.py && python -m pytest -q
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: parser development commands"
```

---

### Task 8: Final verification (whole repo)

- [ ] **Step 1: Run every CI job locally**

```bash
# schema
pnpm --filter @synopsis/schema test && pnpm --filter @synopsis/schema validate
# web
pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web build && pnpm --filter web test:e2e
# parser
cd parser && ruff check . && mypy parse_pdf.py && python -m pytest -q && cd ..
```
Expected: all green.

- [ ] **Step 2: Confirm the golden data is unchanged**

```bash
git status --porcelain -- data/synopsis.json
```
Expected: empty (no modification to the committed data through all of Plan 3).

---

## Self-Review

**1. Spec coverage (parser scope):**
- Parser carried over as-is, then carefully hardened → all tasks. ✓
- mypy + pytest added → Tasks 1, 3, 5. ✓
- Output unchanged, compared to golden `data/synopsis.json` → Task 2 (diff) + Task 3 (full-equality test) + Task 8 (porcelain check). ✓
- ruff/mypy for Python in CI → Tasks 4, 5, 6. ✓
- README documents `python parser/parse_pdf.py` → Task 7. ✓

**2. Placeholder scan:** No TBD/TODO; every code/config step is complete.

**3. Consistency:** `build_data(pdf) -> (data, problems)` defined in Task 2, consumed by `main` (Task 2) and the `parsed` fixture (Task 3); fixture names `parsed`/`golden` shared between `conftest.py` and `test_golden.py`; CI `parser` job uses the same commands as Task 8. The constant `GOSPel_ORDER` is referenced verbatim (original name kept). ✓

**Execution notes:** commit messages end with the `Co-Authored-By: Claude Opus 4.8` trailer; the legacy `site/` + `build_site.py` removal is the next step AFTER this plan (user confirmed "после").
