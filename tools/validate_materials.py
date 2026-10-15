#!/usr/bin/env python3
"""Validate data/materials/cards/*.json: required fields, sources, and derived values vs their formulas."""
import json, sys, glob, re
REQ = ["id", "name", "brand", "category", "unit", "declared", "source", "reference", "status"]
SRC = ["title", "url", "doc_date", "accessed"]
def names(card):
    d = card["declared"]; n = {"pack_kg": card["unit"]["pack_kg"]}
    for k, v in d.items():
        if isinstance(v, (int, float)): n[k] = v
    n["bulk_density"] = d.get("bulk_density_kg_per_m3")
    for k, v in card.get("derived", {}).items():
        if isinstance(v.get("value"), (int, float)): n[k] = v["value"]
    n["hardened_density"] = n.get("hardened_density_kg_per_m3")
    return n
def main():
    bad = 0
    files = sorted(glob.glob("data/materials/cards/*.json"))
    if not files:
        print("FAIL no material cards found"); sys.exit(1)
    for p in files:
        c = json.load(open(p, encoding="utf-8")); err = []
        err += [f"missing {k}" for k in REQ if k not in c]
        err += [f"source.{k} missing" for k in SRC if not c.get("source", {}).get(k)]
        if not str(c.get("source", {}).get("url", "")).startswith("https://"): err.append("source.url must be https")
        if c.get("reference", {}).get("kind") != "reference": err.append("reference.kind must be 'reference'")
        base = names(c)
        for k, v in c.get("derived", {}).items():
            f = v.get("formula"); val = v.get("value")
            if not f or val is None: err.append(f"derived.{k}: formula/value missing"); continue
            if isinstance(val, dict):
                m = re.search(r"consumption_kg_per_m2_by_notch_mm", f)
                table = c["declared"].get("consumption_kg_per_m2_by_notch_mm", {})
                for nk, nv in val.items():
                    exp = base["pack_kg"] / table[nk]
                    if abs(exp - nv) > 0.06 * exp: err.append(f"derived.{k}[{nk}]={nv}, formula gives {exp:.2f}")
                continue
            try: exp = eval(f, {"__builtins__": {}}, base)
            except Exception as e: err.append(f"derived.{k}: cannot evaluate '{f}': {e}"); continue
            if abs(exp - val) > 0.02 * abs(exp): err.append(f"derived.{k}={val}, formula gives {exp:.3f}")
        print(("FAIL " if err else "ok   ") + p + ("" if not err else "\n  - " + "\n  - ".join(err)))
        bad += bool(err)
    sys.exit(1 if bad else 0)
main()
