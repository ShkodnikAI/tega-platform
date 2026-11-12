"""Tests for tools/norms/pick.py on synthetic work records (no private data)."""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "tools", "norms"))
import pick


def work(code, name, per=100.0, unit="м2", labor_h=10.0):
    return {"code": code, "name": name, "per": per, "unit": unit, "labor_h": labor_h,
            "grade": 3.0, "labor_machinist_h": 0.0, "materials": [], "machines": [],
            "replaceable": [], "scope": []}


class TestPick(unittest.TestCase):
    def test_matches_and_picks_shortest_name(self):
        data = {"works": [
            work("E1-1", "Облицовка стен керамической плиткой по кирпичу"),
            work("E1-2", "Облицовка стен керамической плиткой"),  # shorter -> preferred
            work("E1-3", "Облицовка фасадов керамической плиткой"),  # excluded (фасад not matched b/c must has 'стен')
        ]}
        items, matched = pick.build_curated(data, spec=[
            {"id": "tile_wall", "label": "Облицовка стен плиткой", "must": ["облицов", "плит", "стен"], "exclude": ["фасад"]},
        ])
        self.assertEqual(matched, 1)
        self.assertEqual(items[0]["code"], "E1-2")

    def test_exclude_blocks_wrong_room(self):
        data = {"works": [work("E2-1", "Штукатурка потолков цементно-известковым раствором")]}
        items, matched = pick.build_curated(data, spec=[
            {"id": "plaster_wall", "label": "Штукатурка стен", "must": ["штукатур", "стен"], "exclude": ["потолк"]},
        ])
        self.assertEqual(matched, 0)
        self.assertEqual(items, [])

    def test_missing_labor_h_skipped(self):
        w = work("E3-1", "Устройство стяжки цементно-песчаной")
        w["labor_h"] = None
        items, matched = pick.build_curated({"works": [w]}, spec=[
            {"id": "screed_cement", "label": "Стяжка", "must": ["стяжк", "цементно-песчан"], "exclude": []},
        ])
        self.assertEqual(matched, 0)

    def test_no_match_is_silently_skipped(self):
        data = {"works": [work("E4-1", "Что-то совсем другое")]}
        items, matched = pick.build_curated(data, spec=pick.SPEC)
        self.assertEqual(items, [])
        self.assertEqual(matched, 0)

    def test_full_spec_runs_without_error_on_empty_base(self):
        items, matched = pick.build_curated({"works": []})
        self.assertEqual(items, [])
        self.assertEqual(matched, 0)

    def test_write_curated_output_shape(self):
        data = {"works": [work("E1-2", "Облицовка стен керамической плиткой")]}
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "sub", "terms-picks.json")
            matched, total = pick.write_curated(data, out, spec=[
                {"id": "tile_wall", "label": "Облицовка стен плиткой", "must": ["облицов", "плит", "стен"], "exclude": []},
            ])
            self.assertEqual(matched, 1)
            self.assertEqual(total, 1)
            with open(out, encoding="utf-8") as fh:
                payload = json.load(fh)
            self.assertIn("items", payload)
            self.assertEqual(payload["items"][0]["id"], "tile_wall")
            self.assertIn("source", payload)
            self.assertNotIn("name", payload["items"][0])  # don't republish НРР's own item text

    def test_real_spec_entries_have_required_keys(self):
        for s in pick.SPEC:
            self.assertIn("id", s)
            self.assertIn("label", s)
            self.assertTrue(s["must"])


if __name__ == "__main__":
    unittest.main()
