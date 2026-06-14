# -*- coding: utf-8 -*-
"""
Парсер «Евангельского синопсиса» (PDF -> data/synopsis.json).

Подход:
- посимвольное извлечение с координатами (pdfplumber), распределение символов
  по колонкам-«зонам», границы которых берутся из строки-шапки (Мф./Мк./Лк./Ин.);
- модель колонки = список сегментов {глава, prev, next, стихи/заметки}:
  смена главы внутри перикопы задаётся повторной шапкой («Мф.18», «Ин.1»...);
- определение начала стиха ведётся по ожидаемым наборам стихов из поисковых
  таблиц в конце книги (стр. 353-366) + по последовательности номеров;
- в конце — сверка разобранного текста с поисковыми таблицами (отчёт).
"""
import json
import os
import re
import sys
from collections import defaultdict

import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PDF_PATH = os.path.join(ROOT, "Евангельский синопсис.gen.pdf")
OUT_PATH = os.path.join(ROOT, "data", "synopsis.json")
REPORT_PATH = os.path.join(ROOT, "data", "parse_report.txt")

GOSPel_ORDER = ["mt", "mk", "lk", "jn"]
ABBR2KEY = {"Мф": "mt", "Мк": "mk", "Лк": "lk", "Ин": "jn"}
KEY2ABBR = {v: k for k, v in ABBR2KEY.items()}

# Число стихов в главах (синодальная нумерация Евангелий)
VERSE_COUNTS = {
    "mt": [25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20],
    "mk": [45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20],
    "lk": [80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53],
    "jn": [51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25],
}

PERICOPE_PAGES = range(6, 352)      # 1-базные номера страниц основного блока
INDEX_PAGES = range(353, 367)       # поисковые таблицы
PREFACE_PAGES = range(1, 5)
APPENDIX2_PAGES = range(367, 395)
FOOTNOTE_PAGE = 395

report_lines = []


def log(msg):
    report_lines.append(msg)


# ---------------------------------------------------------------- low level

def page_lines(page, keep_small=False, min_size=8.0):
    """Строки страницы: [(top, [chars...])], chars отсортированы по x0."""
    chars = [c for c in page.chars if keep_small or c.get("size", 10) >= min_size]
    chars.sort(key=lambda c: (round(c["top"], 1), c["x0"]))
    lines = []
    for c in chars:
        if lines and abs(lines[-1][0] - c["top"]) <= 2.0:
            lines[-1][1].append(c)
        else:
            lines.append([c["top"], [c]])
    out = []
    for top, cs in lines:
        cs.sort(key=lambda c: c["x0"])
        out.append((top, cs))
    out.sort(key=lambda l: l[0])
    return out


def chars_to_tokens(chars, gap=2.0):
    """Разбивает символы строки на токены по пробельным зазорам."""
    toks = []
    cur, x0, last_x1 = "", None, None
    for c in chars:
        if c["text"].isspace():
            if cur:
                toks.append((x0, last_x1, cur))
                cur, x0 = "", None
            last_x1 = c["x1"]
            continue
        if last_x1 is not None and c["x0"] - last_x1 > gap:
            if cur:
                toks.append((x0, last_x1, cur))
            cur, x0 = "", None
        if x0 is None:
            x0 = c["x0"]
        cur += c["text"]
        last_x1 = c["x1"]
    if cur:
        toks.append((x0, last_x1, cur))
    return toks


def tokens_text(toks):
    return " ".join(t[2] for t in toks)


def is_bold(chars):
    return bool(chars) and all("Bold" in c["fontname"] for c in chars if c["text"].strip())


def join_text(acc, piece):
    """Склейка строк: перенос по дефису соединяет без пробела."""
    piece = piece.strip()
    if not piece:
        return acc
    if not acc:
        return piece
    if acc.endswith(("-", "‑")):
        return acc + piece
    return acc + " " + piece


# ------------------------------------------------------------ header tokens

def parse_header_token(text):
    """'Мф.Мк.Лк.2' -> (['Мф','Мк','Лк'], 2, ''); 'Ин.18(ранее...' -> (['Ин'],18,'(ранее...')."""
    s = text
    i = 0
    gospels = []
    while True:
        while i < len(s) and s[i] in ". ":
            i += 1
        for a in ("Мф", "Мк", "Лк", "Ин"):
            if s.startswith(a, i):
                gospels.append(a)
                i += len(a)
                break
        else:
            break
    if not gospels:
        return None
    while i < len(s) and s[i] in ". ":
        i += 1
    digits = ""
    while i < len(s) and s[i] in "0123456789Зб":
        digits += s[i]
        i += 1
    rest = s[i:].strip()
    if rest and not rest.startswith("("):
        return None
    ch = digits.replace("З", "3").replace("б", "6")
    return gospels, (int(ch) if ch else None), rest


def scan_band_line(chars):
    """Посимвольный разбор строки-шапки.

    Возвращает (headers, annotations):
      headers     — [(x0, [Мф,...], chapter|None)]
      annotations — [(x0, 'текст-фрагмент')]
    Заголовок распознаётся по аббревиатуре евангелиста (с координатой x0
    символа 'М'/'Л'/'И') даже когда он склеен с предыдущей аннотацией без
    пробела ('...п.63)Мк.2'). Всё, что между заголовками, считается
    фрагментом аннотации соседней колонки — в т.ч. незакрытая скобка
    '(ранее ...;', продолжение которой стоит на следующей строке."""
    chars = sorted(chars, key=lambda c: c["x0"])
    s = "".join(c["text"] for c in chars)
    pos2char = []
    for ci, c in enumerate(chars):
        pos2char.extend([ci] * len(c["text"]))
    ABBRS = ("Мф", "Мк", "Лк", "Ин")
    headers, annotations = [], []
    i, n = 0, len(s)
    ann_start = None

    def flush_ann(end):
        nonlocal ann_start
        if ann_start is not None:
            txt = s[ann_start:end].strip()
            if txt:
                annotations.append((chars[pos2char[ann_start]]["x0"], txt))
            ann_start = None

    while i < n:
        if any(s.startswith(a, i) for a in ABBRS):
            flush_ann(i)
            start_i = i
            gospels = []
            while True:
                for b in ABBRS:
                    if s.startswith(b, i):
                        gospels.append(b)
                        i += len(b)
                        break
                else:
                    break
                # точка-разделитель между аббревиатурами (но не перед главой)
                if i < n and s[i] == "." and not (i + 1 < n and s[i + 1] in "0123456789Зб"):
                    i += 1
            if i < n and s[i] == ".":
                i += 1
            digits = ""
            while i < n and s[i] in "0123456789Зб":
                digits += s[i]
                i += 1
            ch = int(digits.replace("З", "3").replace("б", "6")) if digits else None
            headers.append((chars[pos2char[start_i]]["x0"], gospels, ch))
            continue
        if ann_start is None:
            ann_start = i
        i += 1
    flush_ann(n)
    return headers, annotations


REHEADER_RE = re.compile(
    r"^\s*((?:(?:Мф|Мк|Лк|Ин)\.?\s*)+)[\.\s]*([0-9Зб]+)?\s*(\(.*)?$"
)

def parse_reheader_line(text):
    """Повторная шапка внутри колонки: 'Мф.18', 'Ин 12', 'Лк.11 (ранее ...)'."""
    m = REHEADER_RE.match(text.strip())
    if not m:
        return None
    gospels = re.findall(r"Мф|Мк|Лк|Ин", m.group(1))
    if not gospels:
        return None
    ch = m.group(2)
    ch = int(ch.replace("З", "3").replace("б", "6")) if ch else None
    rest = (m.group(3) or "").strip()
    return gospels, ch, rest


REF_RE = re.compile(
    r"\(\s*(ранее|далее|долее)\s*([0-9:–\-—,аб;.\s]*?)\s*[;,]?\s*п\.?\s*"
    r"([0-9.]+(?:\s*[–\-]\s*[0-9.]+)?(?:\s*и\s*(?:п\.?\s*)?[0-9.]+)?)\s*\)"
)

def extract_refs(text):
    """Вынимает (ранее/далее ...; п.N) из текста. -> (clean_text, prev, next)."""
    prev = nxt = None
    def repl(m):
        nonlocal prev, nxt
        kind = m.group(1)
        ref = re.sub(r"\s+", "", m.group(2)).strip(";,")
        pid_raw = m.group(3).strip()
        pm = re.match(r"\d+(?:\.\d+)?", pid_raw)
        pid = pm.group(0) if pm else pid_raw
        item = {"ref": ref, "p": pid, "pRaw": pid_raw}
        if kind in ("ранее",):
            prev = item
        else:
            nxt = item
        return " "
    clean = REF_RE.sub(repl, text)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean, prev, nxt


# ------------------------------------------------------------ index parsing

def parse_verse_ref(ref, gospel):
    """'5:1–8:1' / '11:16,24–32' / '9:43б-45' -> [(chapter, verse, suffix)...]"""
    ref = ref.replace("—", "–").replace("‑", "-").replace(" ", "")
    ref = ref.replace(",", ",")
    # допуск: '11,33–36' -> '11:33–36'
    if ":" not in ref and re.match(r"^\d+,\d", ref):
        ref = ref.replace(",", ":", 1)
    out = []
    counts = VERSE_COUNTS[gospel]

    def expand(ch_a, v_a, ch_b, v_b):
        if ch_a == ch_b:
            for v in range(v_a, v_b + 1):
                out.append((ch_a, v))
        else:
            for v in range(v_a, counts[ch_a - 1] + 1):
                out.append((ch_a, v))
            for ch in range(ch_a + 1, ch_b):
                for v in range(1, counts[ch - 1] + 1):
                    out.append((ch, v))
            for v in range(1, v_b + 1):
                out.append((ch_b, v))

    m = re.match(r"^(\d+):(.+)$", ref)
    if not m:
        return out
    chapter = int(m.group(1))
    body = m.group(2)
    for part in body.split(","):
        part = part.strip()
        if not part:
            continue
        rng = re.match(
            r"^(\d+)[аб]*(?:[–\-](?:(\d+):)?(\d+)[аб]*)?$", part
        )
        if not rng:
            log(f"  ! не разобран диапазон '{part}' в '{ref}' ({gospel})")
            continue
        v_a = int(rng.group(1))
        if rng.group(3) is None:
            out.append((chapter, v_a))
        else:
            ch_b = int(rng.group(2)) if rng.group(2) else chapter
            v_b = int(rng.group(3))
            expand(chapter, v_a, ch_b, v_b)
            chapter = ch_b
    return out


def parse_index(pdf):
    """Поисковые таблицы -> gospel_index[g] = [{ref, pericope, title, np}],
    expected[(pericope, g)] = {(ch, v), ...}"""
    gospel_index = {g: [] for g in GOSPel_ORDER}
    current = None
    for pno in INDEX_PAGES:
        page = pdf.pages[pno - 1]
        for top, chars in page_lines(page):
            text = tokens_text(chars_to_tokens(chars))
            if "Поисковая таблица" in text or text in ("Матфея", "Марка", "Луки", "Иоанна"):
                for name, g in (("Матфея", "mt"), ("Марка", "mk"),
                                ("Луки", "lk"), ("Иоанна", "jn")):
                    if name in text:
                        current = g
                continue
            if text.startswith(("Глава", "стихи", "№", "Приложение")):
                continue
            toks = chars_to_tokens(chars)
            if not toks or current is None:
                continue
            first = toks[0][2]
            m = re.match(r"^(\d+)[:.,]([0-9аб–\-—,:]+)$", first)
            rest = tokens_text(toks[1:])
            if m and toks[0][0] < 200:
                ref = first
                pm = re.match(r"^(\d+(?:\.\d+)?)\.?\s*(.*)$", rest)
                entry = {
                    "ref": ref,
                    "pericope": pm.group(1) if pm else None,
                    "title": pm.group(2) if pm else rest,
                    "np": "(НП)" in rest,
                }
                if "(НП)" in entry["title"]:
                    entry["title"] = entry["title"].replace("(НП)", "").strip()
                gospel_index[current].append(entry)
            elif gospel_index[current]:
                # продолжение названия
                gospel_index[current][-1]["title"] = join_text(
                    gospel_index[current][-1]["title"], text)

    # Нормализация: пометка «(НП)» и номер перикопы иногда оказываются внутри
    # названия (особенно в блоке Нагорной проповеди, где «(НП)» стоит ПЕРЕД
    # номером, а сам номер приходит на строке-продолжении). Вынесем их.
    NP_RE = re.compile(r"\(\s*НП\s*\)")
    PERI_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\.\s+")
    for entries in gospel_index.values():
        for e in entries:
            t = e["title"]
            if NP_RE.search(t):
                e["np"] = True
                t = NP_RE.sub(" ", t)
            t = re.sub(r"\s{2,}", " ", t).strip()
            if not e["pericope"]:
                m = PERI_RE.match(t)
                if m:
                    e["pericope"] = m.group(1)
                    t = t[m.end():].strip()
            e["title"] = t

    expected = defaultdict(set)
    for g, entries in gospel_index.items():
        for e in entries:
            if not e["pericope"]:
                continue
            for (ch, v) in parse_verse_ref(e["ref"], g):
                expected[(e["pericope"], g)].add((ch, v))
    return gospel_index, expected


# --------------------------------------------------------------- main block

VERSE_TOKEN_RE = re.compile(r"^(\d{1,3})(а|б|ба|аб)?$")
EXTRA_BLOCK_RE = re.compile(r"^\s*(1\s*Кор|Деян)\.?\s*(\d+)\s*$")

# алиасы для опечаток в указателе/ссылках
PERICOPE_ALIASES = {"99.9": "99.8"}


class Zone:
    def __init__(self, x0, gospel_key, chapter):
        self.x0 = x0
        self.gospel = gospel_key      # 'mt'... или None (пустая)
        self.segments = []            # сегменты колонки
        self.cur_seg = None
        self.cur_verse = None
        self.note_buf = ""
        if gospel_key and chapter:
            self.new_segment(chapter)

    def new_segment(self, chapter, prev=None):
        self.flush()
        self.cur_seg = {
            "gospel": self.gospel, "chapter": chapter,
            "prev": prev, "next": None, "items": []}
        self.segments.append(self.cur_seg)
        self.cur_verse = None

    def flush(self):
        self.flush_note()
        if self.cur_verse is not None:
            text, prev, nxt = extract_refs(self.cur_verse["t"])
            self.cur_verse["t"] = text
            if prev and self.cur_seg and not self.cur_seg["prev"]:
                self.cur_seg["prev"] = prev
            if nxt and self.cur_seg:
                self.cur_seg["next"] = nxt
            self.cur_verse = None

    def flush_note(self):
        if self.note_buf.strip() and self.cur_seg:
            text, prev, nxt = extract_refs(self.note_buf)
            if prev and not self.cur_seg["prev"]:
                self.cur_seg["prev"] = prev
            if nxt:
                self.cur_seg["next"] = nxt
            if text.strip("() "):
                self.cur_seg["items"].append({"note": text})
        self.note_buf = ""


class PericopeBuilder:
    def __init__(self, pid, title_first_line, page_no, order):
        self.id = pid
        self.title_lines = [title_first_line]
        self.pages = [page_no]
        self.order = order
        self.place = None
        self.notes = []
        self.zones = []            # активная сетка колонок
        self.done_zones = []       # зоны предыдущих сеток (после re-band)
        self.band_lines = []       # строки шапки (top, chars)
        self.state = "preband"     # preband -> band -> body -> extra
        self.band_top = None
        self.extra = None          # блок 1Кор/Деян
        self.verse_starts = []     # (gtop, gospel, chapter, vlabel)
        self.expected = {}         # (gospel) -> {(ch,v)} ещё не встреченных
        self.last_v = {}           # gospel -> (ch, int, suffix)

    # --- шапка ---------------------------------------------------------
    def finish_band(self):
        """Разбор накопленных строк шапки: зоны + аннотации."""
        headers = []        # (x0, gospels, chapter)
        annotations = []    # (x0, text)
        for top, chars in self.band_lines:
            hh, aa = scan_band_line(chars)
            headers.extend(hh)
            annotations.extend(aa)
        headers.sort(key=lambda h: h[0])
        merged = []
        for h in headers:
            if merged and abs(h[0] - merged[-1][0]) < 8:
                continue  # дубль той же зоны на другой строке
            merged.append(h)
        for (x0, gospels, chapter) in merged:
            gkey = ABBR2KEY[gospels[-1]] if chapter else None
            z = Zone(x0, gkey if chapter else None, chapter)
            z.label_gospels = [ABBR2KEY[g] for g in gospels]
            self.zones.append(z)
        self.zones.sort(key=lambda z: z.x0)
        # аннотации шапки -> по зонам
        ann = defaultdict(str)
        for (x0, text) in annotations:
            zi = self.zone_index(x0)
            ann[zi] = join_text(ann[zi], text)
        for zi, text in ann.items():
            z = self.zones[zi]
            clean, prev, nxt = extract_refs(text)
            if z.cur_seg is not None:
                if prev:
                    z.cur_seg["prev"] = prev
                if nxt:
                    z.cur_seg["next"] = nxt
                if clean.strip("() "):
                    z.cur_seg["items"].append({"note": clean})
            elif clean.strip("() ") or prev or nxt:
                log(f"  ? п.{self.id}: аннотация у пустой зоны {zi}: '{text}'")
        self.state = "body"

    def zone_index(self, x0):
        idx = 0
        for i, z in enumerate(self.zones):
            if x0 >= self.zone_bounds[i]:
                idx = i
        return idx

    @property
    def zone_bounds(self):
        """Левые границы зон для распределения символов.

        Граница зоны i — это её левый край (zones[i].x0) минус небольшой
        допуск δ. Так номер стиха колонки i, начинающийся ровно на её x0,
        попадает в свою зону, а «нависающий» хвост слова предыдущей колонки
        (которая в вёрстке всегда оканчивается левее x0 следующей) остаётся
        в своей зоне. Середина между колонками для этого слишком груба:
        текст широкой левой колонки доходит почти до x0 правой и при
        midpoint-границе утекал бы вправо."""
        if not self.zones:
            return [0]
        delta = 1.5
        b = [self.zones[0].x0 - 50]
        for i in range(1, len(self.zones)):
            b.append(self.zones[i].x0 - delta)
        return b

    # --- ожидания из указателя ------------------------------------------
    def set_expected(self, expected_map):
        # Подпункт (91.3) может отсутствовать в указателе отдельной строкой —
        # тогда берём диапазон родителя (91), чтобы распознавание стихов всё
        # же сработало: стих подпункта лежит внутри диапазона родителя.
        ids = [self.id]
        if "." in self.id:
            parts = self.id.split(".")
            for i in range(1, len(parts)):
                ids.append(".".join(parts[:i]))
        # учитываем псевдонимы указателя (в книге пункт 99.8, в указателе 99.9)
        for af, at in PERICOPE_ALIASES.items():
            if at in ids and af not in ids:
                ids.append(af)
        for g in GOSPel_ORDER:
            s = set()
            for pid in ids:
                s |= expected_map.get((pid, g), set())
            self.expected[g] = s
        # Колонки, для которых указатель не дал НИ ОДНОГО стиха (строка таблицы
        # склеилась с соседней и потеряла номер перикопы — напр. Мф 11, 23).
        # Там нет «белого списка» для распознавания, поэтому ниже доверяем
        # собственной нумерации текста, иначе все стихи осели бы в заметках.
        self.exp_empty = {g: not self.expected[g] for g in GOSPel_ORDER}

    # --- основной поток --------------------------------------------------
    def feed_line(self, page_no, top, chars):
        gtop = page_no * 1000 + top
        if page_no not in self.pages:
            self.pages.append(page_no)
        text_full = tokens_text(chars_to_tokens(chars)).strip()

        if self.state in ("preband", "band"):
            if is_bold(chars):  # продолжение заголовка
                if self.state == "preband" and not self.place and not self.band_lines:
                    self.title_lines.append(text_full)
                    return
            has_header = any(
                parse_header_token(t[2]) for t in chars_to_tokens(chars))
            if self.state == "preband":
                if has_header:
                    self.state = "band"
                    self.band_top = top
                    self.band_lines.append((top, chars))
                    return
                if self.place is None:
                    self.place = text_full
                else:
                    self.notes.append(text_full)
                return
            # band: копим, пока не начнётся «телесная» строка
            if self.looks_like_body_start(chars):
                self.finish_band()
                # продолжаем как body (упадёт ниже)
            else:
                self.band_lines.append((top, chars))
                return

        if self.state == "extra":
            self.feed_extra(text_full)
            return

        # --- body ---
        m = EXTRA_BLOCK_RE.match(text_full)
        if m:
            for z in self.zones:
                z.flush()
            src = m.group(1).replace(" ", "") + "." + m.group(2)
            self.extra = {"source": src, "items": []}
            self.state = "extra"
            return

        # распределяем СИМВОЛЫ по зонам (граница может проходить внутри
        # слипшегося токена вида 'ты18'), затем токенизируем каждую зону
        per_zone_chars = defaultdict(list)
        for c in chars:
            per_zone_chars[self.zone_index(c["x0"])].append(c)
        for zi in sorted(per_zone_chars):
            cs = sorted(per_zone_chars[zi], key=lambda c: c["x0"])
            toks = chars_to_tokens(cs)
            if toks:
                self.feed_zone_line(zi, toks, gtop)

    def looks_like_body_start(self, chars):
        """Строка после шапки, начинающаяся с номера стиха."""
        toks = chars_to_tokens(chars)
        if not toks:
            return False
        for t in toks:
            m = VERSE_TOKEN_RE.match(t[2])
            if m:
                return True
        return False

    def feed_zone_line(self, zi, toks, gtop):
        z = self.zones[zi]
        text = tokens_text(toks).strip()
        if not text:
            return
        # повторная шапка / смена главы?
        rh = parse_reheader_line(text)
        if rh:
            gospels, chapter, rest = rh
            gkey = ABBR2KEY[gospels[-1]]
            if chapter:
                same = (z.cur_seg and z.gospel == gkey
                        and z.cur_seg["chapter"] == chapter and not rest)
                if same:
                    return  # просто повтор подписи колонки
                z.flush()
                z.gospel = gkey
                prev = None
                if rest:
                    _, prev, nxt2 = extract_refs(rest)
                z.new_segment(chapter, prev=prev)
                if rest:
                    _, _, nxt2 = extract_refs(rest)
                    if nxt2:
                        z.cur_seg["next"] = nxt2
                return
            if not rest:
                return  # голая подпись 'Мф.' и т.п.
            text = rest  # 'Ин. (ранее...)' — хвост считаем заметкой

        first = toks[0][2]
        vm = VERSE_TOKEN_RE.match(first)
        if vm and z.gospel:
            n = int(vm.group(1))
            suf = vm.group(2) or ""
            exp = self.expected.get(z.gospel, set())
            ch = z.cur_seg["chapter"] if z.cur_seg else None
            last = self.last_v.get(z.gospel)
            ok = False
            if ch is not None:
                if (ch, n) in exp:
                    ok = True
                elif last and last[0] == ch and n == last[1] + 1:
                    ok = True
                elif last and last[0] == ch and n == last[1] and suf != last[2]:
                    ok = True
                elif (getattr(self, "exp_empty", {}).get(z.gospel)
                      and (last is None or last[0] != ch or n > last[1])):
                    # указателя для этой колонки нет — доверяем нумерации текста:
                    # начинаем последовательность или продолжаем по возрастанию
                    ok = True
            if ok:
                z.flush()
                z.cur_verse = {"v": n, "suf": suf,
                               "t": tokens_text(toks[1:])}
                z.cur_seg["items"].append(z.cur_verse)
                exp.discard((ch, n))
                self.last_v[z.gospel] = (ch, n, suf)
                self.verse_starts.append(
                    (gtop, z.gospel, ch, f"{n}{suf}"))
                return
        # заметка-ссылка или продолжение текста
        if z.cur_verse is None or (text.startswith("(") and
                                   re.match(r"^\((?:ранее|далее|долее|см)", text)):
            z.flush() if (z.cur_verse is not None) else None
            z.note_buf = join_text(z.note_buf, text)
            if z.note_buf.count("(") <= z.note_buf.count(")"):
                z.flush_note()
        else:
            z.cur_verse["t"] = join_text(z.cur_verse["t"], text)

    def feed_extra(self, text):
        toks = text.split(" ", 1)
        m = VERSE_TOKEN_RE.match(toks[0]) if toks else None
        items = self.extra["items"]
        if m and (not items or int(m.group(1)) == items[-1]["v"] + 1 or
                  int(m.group(1)) <= 11):
            items.append({"v": int(m.group(1)), "suf": "",
                          "t": toks[1] if len(toks) > 1 else ""})
        elif items:
            items[-1]["t"] = join_text(items[-1]["t"], text)

    # --- завершение -------------------------------------------------------
    def finalize(self):
        if self.state == "band":
            self.finish_band()
        for z in self.zones:
            z.flush()
        title = " ".join(self.title_lines)
        m = re.match(r"^(\d+(?:\.\d+)?)(?:\.\s*|\s+)(.*)$", title)
        tid, ttext = (m.group(1), m.group(2)) if m else (self.id, title)
        columns = {g: None for g in GOSPel_ORDER}
        for z in self.zones:
            if z.gospel and z.segments:
                segs = [s for s in z.segments if s["items"] or s["prev"] or s["next"]]
                if not segs:
                    continue
                if columns[z.gospel] is None:
                    columns[z.gospel] = {"segments": []}
                columns[z.gospel]["segments"].extend(segs)
        out = {
            "id": tid,
            "title": ttext.strip(),
            "place": self.place,
            "pages": self.pages,
            "order": self.order,
            "columns": columns,
        }
        if self.notes:
            out["headnote"] = " ".join(self.notes)
        if self.extra and self.extra["items"]:
            out["extra"] = self.extra
        out["alignment"] = self.build_alignment()
        return out

    def build_alignment(self):
        starts = sorted(self.verse_starts)
        active = {g for (_, g, _, _) in starts}
        if len(active) < 2:
            return None
        rows = []
        cur = None
        for (gtop, g, ch, vl) in starts:
            if cur is None or gtop - cur["top0"] > 13 or g in cur["row"]:
                cur = {"top0": gtop, "row": {}}
                rows.append(cur)
            cur["row"][g] = f"{ch}:{vl}"
            cur["top0"] = min(cur["top0"], gtop)
        return [r["row"] for r in rows]


def classify_section_page(page):
    """Все строки жирные и их немного -> страница-шмуцтитул."""
    lines = page_lines(page)
    if not lines or len(lines) > 4:
        return None
    for top, chars in lines:
        if not is_bold(chars):
            return None
    text = page.extract_text() or ""
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def parse_main(pdf, expected_map):
    sections = []
    pericopes = []
    cur_section = {"id": 0, "title": "Введение", "pericopeIds": []}
    sections.append(cur_section)
    builder = None
    order = 0

    for pno in PERICOPE_PAGES:
        page = pdf.pages[pno - 1]
        sec = classify_section_page(page)
        if sec is not None:
            if sec == "Евангельский синопсис":
                continue
            if builder:
                pericopes.append(builder.finalize())
                builder = None
            cur_section = {"id": len(sections), "title": sec, "pericopeIds": []}
            sections.append(cur_section)
            continue
        for top, chars in page_lines(page):
            text = tokens_text(chars_to_tokens(chars)).strip()
            if not text:
                continue
            if is_bold(chars):
                # Заголовок перикопы: жирная строка «N. Название» или
                # «N.M. Название». Разделитель между номером и названием
                # бывает «нестандартным»: точка без пробела («33.Исцеление»)
                # или пробел без точки («160 У Креста»). Поэтому допускаем
                # либо точку (с любыми пробелами), либо пробелы, и требуем
                # заглавную букву названия, чтобы не спутать с жирной цифрой.
                m = re.match(r"^(\d+(?:\.\d+)?)(?:\.\s*|\s+)[А-ЯЁA-Z]", text)
                if m:
                    if builder:
                        pericopes.append(builder.finalize())
                    order += 1
                    builder = PericopeBuilder(m.group(1), text, pno, order)
                    builder.set_expected(expected_map)
                    cur_section["pericopeIds"].append(m.group(1))
                    continue
                if builder and builder.state == "preband" and not builder.place \
                        and not builder.band_lines:
                    builder.title_lines.append(text)
                    continue
            if builder:
                builder.feed_line(pno, top, chars)
    if builder:
        pericopes.append(builder.finalize())
    return sections, pericopes


# ----------------------------------------------------------- front/back matter

def parse_prefaces(pdf):
    prefaces = []
    cur = None
    para = ""
    def flush_para():
        nonlocal para
        if cur is not None and para.strip():
            cur["paragraphs"].append(para.strip())
        para = ""
    for pno in PREFACE_PAGES:
        page = pdf.pages[pno - 1]
        for top, chars in page_lines(page):
            text = tokens_text(chars_to_tokens(chars)).strip()
            if not text or text == "Евангельский синопсис":
                continue
            x0 = chars[0]["x0"]
            if text.startswith("Предисловие к") and x0 < 200:
                # ссылки-оглавление на стр.1 пропускаем (есть на той же стр. заголовок)
                if cur is None and "первому" in text:
                    flush_para()
                    cur = {"title": "Предисловие к первому изданию", "paragraphs": []}
                    prefaces.append(cur)
                    continue
                if cur is not None and "второму" in text and cur["title"].endswith("первому изданию") \
                        and pno >= 4:
                    flush_para()
                    cur = {"title": "Предисловие ко второму изданию", "paragraphs": []}
                    prefaces.append(cur)
                    continue
                continue
            if cur is None:
                continue
            if x0 > 90:  # отступ — новый абзац
                flush_para()
            para = join_text(para, text)
    flush_para()
    return prefaces


def parse_footnotes(pdf):
    page = pdf.pages[FOOTNOTE_PAGE - 1]
    notes = []
    cur = None
    for top, chars in page_lines(page, keep_small=True):
        text_chars = [c for c in chars if c.get("size", 10) >= 8]
        small = [c for c in chars if c.get("size", 10) < 8]
        text = tokens_text(chars_to_tokens(text_chars)).strip()
        if "Примечания" in text and not small:
            continue
        if small and small[0]["x0"] <= (text_chars[0]["x0"] if text_chars else 1e9):
            num = "".join(c["text"] for c in small)
            cur = {"n": num, "text": re.sub(r"^\s*-\s*", "", text)}
            notes.append(cur)
        elif cur:
            cur["text"] = join_text(cur["text"], text)
    return notes


def parse_appendix2(pdf):
    """Сравнительная таблица хронологий — по 6 колонкам с фикс. границами."""
    intro = []
    rows = []
    col_x = None
    header_names = ["Синопсис", "Еп. Феофан", "Библия, 1988", "Еп. Аверкий",
                    "Иванов", "Брюссель"]
    for pno in APPENDIX2_PAGES:
        page = pdf.pages[pno - 1]
        for top, chars in page_lines(page):
            toks = chars_to_tokens(chars)
            text = tokens_text(toks).strip()
            if not text:
                continue
            if pno == 367:
                if "Приложение 2" in text:
                    continue
                if "Еп. Феофан" in text:
                    # граница колонок по шапке
                    xs = [75]
                    for (x0, x1, t) in toks:
                        if t in ("Еп.", "Библия,", "Иванов"):
                            xs.append(x0)
                    xs = sorted(set(xs))
                    # колонок реально 5 видимых (6-я обрезана в исходнике)
                    col_x = xs
                    continue
                if col_x is None:
                    intro.append(text)
                    continue
            if col_x is None:
                continue
            cells = ["", "", "", "", ""]
            for (x0, x1, t) in toks:
                ci = 0
                for i, cx in enumerate(col_x):
                    if x0 >= cx - 3:
                        ci = i
                cells[min(ci, 4)] = join_text(cells[min(ci, 4)], t)
            rows.append(cells)
    return {"title": "Приложение 2. Сравнительная таблица евангельских хронологий",
            "intro": intro, "columns": header_names[:5], "rows": rows}


# ------------------------------------------------------------------ validate

def validate(pericopes, expected_map, gospel_index):
    by_id = {p["id"]: p for p in pericopes}
    problems = 0
    parsed_sets = defaultdict(set)
    for p in pericopes:
        for g, col in p["columns"].items():
            if not col:
                continue
            for seg in col["segments"]:
                for it in seg["items"]:
                    if "v" in it:
                        parsed_sets[(p["id"], g)].add((seg["chapter"], it["v"]))

    # Перикопы-контейнеры: текст живёт в подпунктах (46 -> 46.1, 46.2 ...).
    # Указатель в конце книги даёт родителю полный диапазон, равный
    # объединению детей, поэтому при сверке к разобранным стихам родителя
    # добавляем стихи всех его потомков.
    all_ids = {p["id"] for p in pericopes}
    children = defaultdict(list)
    for cid in all_ids:
        if "." in cid:
            parts = cid.split(".")
            for i in range(1, len(parts)):
                children[".".join(parts[:i])].append(cid)

    def parsed_for(pid, g):
        s = set(parsed_sets.get((pid, g), set()))
        for c in children.get(pid, []):
            s |= parsed_sets.get((c, g), set())
        return s

    def own_exp(pid, g):
        """Диапазон из указателя для самой перикопы (+псевдонимы)."""
        s = set(expected_map.get((pid, g), set()))
        for af, at in PERICOPE_ALIASES.items():
            if at == pid:
                s |= expected_map.get((af, g), set())
        return s

    def anc_exp(pid, g):
        """Диапазон перикопы вместе со всеми предками (91.3 -> +91)."""
        s = own_exp(pid, g)
        if "." in pid:
            parts = pid.split(".")
            for i in range(1, len(parts)):
                s |= own_exp(".".join(parts[:i]), g)
        return s

    def desc_exp(pid, g):
        """Диапазоны всех потомков (для контейнера: его стихи = объединение
        стихов детей, поэтому их диапазоны не должны считаться «лишними»)."""
        s = set()
        for c in children.get(pid, []):
            s |= own_exp(c, g)
        return s

    # ключи по каноническим (после псевдонимов) идентификаторам
    norm_keys = set()
    for (pid, g) in set(parsed_sets) | set(expected_map):
        norm_keys.add((PERICOPE_ALIASES.get(pid, pid), g))

    def fmt(s):
        return ", ".join(f"{c}:{v}" for c, v in sorted(s))

    recovered = 0   # стихи, восстановленные по тексту там, где указатель пуст
    for (pid, g) in sorted(norm_keys, key=lambda k: (k[0], k[1])):
        got = parsed_for(pid, g)
        allowed = anc_exp(pid, g) | desc_exp(pid, g)
        # Битая строка указателя (склейка/потеря номера) — диапазона нет вовсе.
        # Стихи восстановлены по собственной нумерации текста; сверять не с чем,
        # это не расхождение, а информагия.
        if not allowed:
            if got:
                recovered += len(got)
            continue
        own = own_exp(pid, g)
        # «нет в разборе» — только против собственного диапазона; у подпункта
        # без отдельной строки указателя его нет, родитель проверит за него.
        missing = (own - got) if own else set()
        # «лишние» — стих вне диапазона перикопы, её предков и потомков.
        extra = got - allowed
        if missing or extra:
            problems += 1
            log(f"  п.{pid} [{KEY2ABBR[g]}]"
                + (f" нет в разборе: {fmt(missing)}" if missing else "")
                + (f" | лишние: {fmt(extra)}" if extra else ""))
    if recovered:
        log(f"  (восстановлено по тексту без строки указателя: {recovered} стихов)")
    return problems


# ----------------------------------------------------------------------- run

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


if __name__ == "__main__":
    main()
