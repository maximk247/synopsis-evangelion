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
