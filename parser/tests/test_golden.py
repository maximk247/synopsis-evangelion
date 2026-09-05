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


def test_pericope_51_11_lord_prayer_luke_verse_4(parsed):
    # В вёрстке PDF у колонки Лк.11 потерян номер стиха 4 - восстанавливаем
    p = _by_id(parsed, "51.11")
    assert p is not None
    seg = next(s for s in p["columns"]["lk"]["segments"] if s["chapter"] == 11)
    verses = {it["v"]: it["t"] for it in seg["items"] if "v" in it}
    assert sorted(verses) == [2, 3, 4]
    assert verses[3] == "хлеб наш насущный подавай нам на каждый день;"
    assert verses[4].startswith("и прости нам грехи наши,")


def test_pericope_130_matthew_verse_10(parsed):
    # В вёрстке PDF номер Мф 26:10 набран с точкой - такой токен тоже номер стиха
    p = _by_id(parsed, "130")
    assert p is not None
    seg = next(s for s in p["columns"]["mt"]["segments"] if s["chapter"] == 26)
    verses = {it["v"]: it["t"] for it in seg["items"] if "v" in it}
    assert sorted(verses) == [6, 7, 8, 9, 10, 11, 12, 13]
    assert verses[9].endswith("за большую цену и дать нищим.")
    assert verses[10].startswith("Но Иисус, уразумев сие,")


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


def test_pericope_90_second_table_splits_matthew_and_luke(parsed):
    # Вторая таблица перикопы набрана по другой сетке колонок: Мф 11:20-24 слева,
    # Лк 10:13-16 справа. Обе колонки должны попасть каждая в своё евангелие.
    p = _by_id(parsed, "90")
    assert p is not None
    assert p["columns"]["mk"] is None
    assert p["columns"]["jn"] is None

    def verses(g):
        return {
            it["v"]: it["t"]
            for s in p["columns"][g]["segments"]
            for it in s["items"]
            if "v" in it
        }

    mt = verses("mt")
    lk = verses("lk")
    assert sorted(mt) == [20, 21, 22, 23, 24]
    assert sorted(lk) == list(range(1, 17))
    assert mt[21].endswith("во вретище и пепле покаялись,")
    assert lk[13].startswith("Горе тебе, Хоразин!")
    assert lk[16].endswith("отвергается Пославшего Меня.")

    mt_seg = next(s for s in p["columns"]["mt"]["segments"] if s["chapter"] == 11)
    assert mt_seg["prev"]["ref"] == "11:2–19"
    assert mt_seg["next"]["ref"] == "11:25–30"
    lk_last = p["columns"]["lk"]["segments"][-1]
    assert lk_last["next"]["ref"] == "10:17–24"


def test_segments_live_in_the_column_of_their_own_gospel(parsed):
    # Зона может сменить евангелие посреди перикопы; сегмент всё равно должен
    # попасть в колонку своего евангелия, иначе читалка покажет чужой текст.
    for p in parsed["pericopes"]:
        for g, col in p["columns"].items():
            if not col:
                continue
            for seg in col["segments"]:
                assert seg["gospel"] == g, f'п.{p["id"]}: {seg["gospel"]}.{seg["chapter"]} в колонке {g}'


def test_pericope_154_luke_column_is_not_matthew(parsed):
    # Лк 23:13-16 набраны в перикопе под колонкой Мф
    p = _by_id(parsed, "154")
    assert p is not None
    seg = next(s for s in p["columns"]["lk"]["segments"] if s["chapter"] == 23)
    assert [it["v"] for it in seg["items"] if "v" in it] == [13, 14, 15, 16]
    mt_chapters = {s["chapter"] for s in p["columns"]["mt"]["segments"]}
    assert mt_chapters == {27}


def test_pericope_143_3_mark_column_is_not_john(parsed):
    # Мк 14:18-21 набраны в перикопе под колонкой Ин
    p = _by_id(parsed, "143.3")
    assert p is not None
    seg = next(s for s in p["columns"]["mk"]["segments"] if s["chapter"] == 14)
    assert [it["v"] for it in seg["items"] if "v" in it] == [18, 19, 20, 21]
    jn_chapters = {s["chapter"] for s in p["columns"]["jn"]["segments"]}
    assert jn_chapters == {13}
