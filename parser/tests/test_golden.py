def _by_id(data, pid):
    return next((p for p in data["pericopes"] if p["id"] == pid), None)


def test_full_output_matches_golden(parsed, golden):
    # A fresh parse must reproduce the committed data (structurally).
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
