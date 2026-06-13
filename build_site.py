#!/usr/bin/env python3
"""Сборка статического сайта-ридера.

Копирует data/synopsis.json внутрь site/data/, чтобы папка site/ была
самодостаточной и разворачивалась как статика (GitHub Pages / Netlify / Vercel).

Запуск всей сборки одной командой:
    python parser/parse_pdf.py && python build_site.py

Локальный просмотр:
    python -m http.server -d site 8000   →  http://localhost:8000/
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "data", "synopsis.json")
DST_DIR = os.path.join(ROOT, "site", "data")
DST = os.path.join(DST_DIR, "synopsis.json")


def main():
    if not os.path.exists(SRC):
        sys.exit(f"Нет {SRC}. Сначала запустите: python parser/parse_pdf.py")
    os.makedirs(DST_DIR, exist_ok=True)
    shutil.copyfile(SRC, DST)
    kb = round(os.path.getsize(DST) / 1024)
    print(f"OK: {SRC} -> {DST} ({kb} KB)")
    print("Просмотр:  python -m http.server -d site 8000")


if __name__ == "__main__":
    main()
