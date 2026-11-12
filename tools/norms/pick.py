"""Curated extract from the НРР-2022 library for public calculators.

Publishes a SMALL, hand-picked set of labour-hour figures (per code, per, unit, labor_h)
for a fixed list of common work types -- not a search API over the full base. See
docs/norms-library.md. The spec below lists what we look for; matching against the real
base (names, codes) happens only at runtime inside the Render container, which is the
only place the decrypted base ever exists. This module never sees real НРР text itself
when run here -- it is exercised against synthetic data in tests/norms/test_pick.py.

Each spec entry is matched by requiring ALL "must" substrings (case-insensitive) in the
work's name and NONE of the "exclude" substrings; among matches we keep the one with the
shortest name (fewest qualifiers -- usually the base item, not aniche variant). A spec
with no match in the live base is silently skipped (only a count is logged, never which
ones) -- the published set is whatever the real base actually contains.
"""
import json
import os
import time

SPEC = [
    {"id": "tile_floor", "label": "Облицовка полов керамической плиткой",
     "must": ["облицов", "плит", "пол"], "exclude": ["фасад", "стен"]},
    {"id": "tile_wall", "label": "Облицовка стен керамической плиткой",
     "must": ["облицов", "плит", "стен"], "exclude": ["фасад", "пол"]},
    {"id": "screed_cement", "label": "Устройство стяжки цементно-песчаной",
     "must": ["стяжк", "цементно-песчан"], "exclude": []},
    {"id": "plaster_wall", "label": "Штукатурка стен",
     "must": ["штукатур", "стен"], "exclude": ["потолк", "фасад"]},
    {"id": "plaster_ceiling", "label": "Штукатурка потолков",
     "must": ["штукатур", "потолк"], "exclude": ["фасад"]},
    {"id": "putty_wall", "label": "Шпаклёвка стен",
     "must": ["шпаклев", "стен"], "exclude": ["потолк"]},
    {"id": "paint_wall_wd", "label": "Окраска стен водно-дисперсионными составами",
     "must": ["окраск", "стен", "водно-дисперсион"], "exclude": ["потолк"]},
    {"id": "paint_ceiling_wd", "label": "Окраска потолков водно-дисперсионными составами",
     "must": ["окраск", "потолк", "водно-дисперсион"], "exclude": []},
    {"id": "wallpaper", "label": "Оклейка стен обоями",
     "must": ["оклейк", "обо"], "exclude": ["потолк"]},
    {"id": "laminate_floor", "label": "Устройство покрытия пола из ламината",
     "must": ["ламинат"], "exclude": []},
    {"id": "gkl_wall", "label": "Устройство перегородок из гипсокартонных листов",
     "must": ["перегородк", "гипсокартон"], "exclude": []},
    {"id": "gkl_ceiling", "label": "Устройство подвесных потолков из гипсокартонных листов",
     "must": ["подвесн", "потолк", "гипсокартон"], "exclude": []},
    {"id": "brickwork", "label": "Кладка стен из кирпича",
     "must": ["кладка", "кирпич"], "exclude": ["разборк"]},
    {"id": "concrete_foundation", "label": "Устройство бетонных фундаментов",
     "must": ["бетон", "фундамент"], "exclude": []},
    {"id": "primer_wall", "label": "Грунтовка стен",
     "must": ["грунтовк", "стен"], "exclude": ["потолк"]},
    {"id": "facade_insulation", "label": "Утепление фасадов",
     "must": ["утепл", "фасад"], "exclude": []},
    {"id": "facade_plaster", "label": "Штукатурка фасадов",
     "must": ["штукатур", "фасад"], "exclude": []},
    {"id": "self_leveling_floor", "label": "Устройство наливных самонивелирующихся полов",
     "must": ["наливн", "пол"], "exclude": []},
    {"id": "demolition_brick_wall", "label": "Разборка кирпичных стен",
     "must": ["разборк", "кирпичн"], "exclude": []},
    {"id": "pipe_laying_water", "label": "Прокладка трубопроводов водоснабжения",
     "must": ["трубопровод", "водоснабж"], "exclude": []},
    {"id": "cable_laying", "label": "Прокладка кабеля",
     "must": ["прокладк", "кабел"], "exclude": []},
]


def _matches(name, spec):
    low = name.lower()
    return all(m.lower() in low for m in spec["must"]) and not any(e.lower() in low for e in spec.get("exclude", []))


def build_curated(data, spec=SPEC):
    """data: the norms.json dict ({"works": [...], ...}). Returns (items, matched_count)."""
    works = data.get("works", [])
    items = []
    for s in spec:
        candidates = [
            w for w in works
            if _matches(w.get("name") or "", s)
            and w.get("labor_h") and w.get("per") and w.get("unit")
        ]
        if not candidates:
            continue
        candidates.sort(key=lambda w: (len(w.get("name") or ""), w.get("code") or ""))
        best = candidates[0]
        items.append({
            "id": s["id"],
            "label": s["label"],
            "code": best["code"],
            "per": best["per"],
            "unit": best["unit"],
            "labor_h": best["labor_h"],
        })
    return items, len(items)


def write_curated(data, out_path, spec=SPEC):
    items, matched = build_curated(data, spec)
    payload = {
        "source": "НРР-2022 (РНТЦ)",
        "note": "Трудозатраты чел.-ч на указанный объём; выработку на смену считает калькулятор. "
                "Нормы -- собственность РНТЦ, условия использования проверяет владелец сайта.",
        "generated": int(time.time()),
        "items": items,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp = out_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, out_path)
    return matched, len(spec)
