#!/usr/bin/env python3
"""Build the normalized norms library from raw SmrPro / NRR-2022 tables.

Input dir (case-insensitive names): rscer.dat/.fpt, mat.dat/.fpt, meh.dat/.fpt
Output: norms.json  (works, materials, machines, meta) -- PRIVATE data, never commit in plain text.

Usage: build.py RAW_DIR OUT_DIR [--sections Е15,Е11]   (sections = collection prefixes; default all)
"""
import argparse, json, os, re, sys, hashlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vfp import VfpTable


def find(raw, name):
    low = {f.lower(): f for f in os.listdir(raw)}
    return os.path.join(raw, low[name.lower()]) if name.lower() in low else None


def num(s):
    s = (s or "").strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def pairs(s, sep="~"):
    out = []
    for tok in (s or "").split("#"):
        if sep in tok:
            k, q = tok.split(sep, 1)
            v = num(q)
            if k and v is not None:
                out.append((k, v))
    return out


def parse_unit(txt):
    m = re.match(r"^\s*([\d.,]+)?\s*(.*)$", txt or "")
    qty = num(m.group(1)) if m and m.group(1) else 1.0
    return qty, (m.group(2).strip() if m else (txt or ""))


def collection(code):
    return code.split("-")[0].rstrip("*")


def build(raw, out, sections=None):
    rs = find(raw, "rscer.dat")
    ms = find(raw, "mat.dat")
    hs = find(raw, "meh.dat")
    if not (rs and ms and hs):
        raise SystemExit("need rscer, mat, meh tables in " + raw)
    def tbl(dat):
        return VfpTable(dat, find(raw, os.path.basename(dat)[:-4] + ".fpt"))
    wanted = {s for s in sections} if sections else None
    works, mat_used, mach_used = [], set(), set()
    for r in tbl(rs):
        code = r["OBOSN"]
        if wanted and collection(code) not in wanted:
            continue
        f = (r["PRM"] or "").split("#")
        f += [""] * (8 - len(f))
        qty, unit = parse_unit(f[0])
        w = {
            "code": code,
            "name": (r["NAIM"] or "").strip(),
            "per": qty, "unit": unit,
            "labor_h": num(f[2]), "grade": num(f[3]), "labor_machinist_h": num(f[6]),
            "materials": [{"code": k, "qty": q} for k, q in pairs(r["MAT"])],
            "machines": [{"code": k, "hours": q} for k, q in pairs(r["MEH"])],
            "replaceable": [],
            "scope": [x.strip() for x in re.split(r"[\r\n]+", r["TXT"] or "") if x.strip()],
        }
        for tok in (r["RNMAT"] or "").split("#"):
            p = tok.split("'")
            if len(p) >= 4 and num(p[3]) is not None:
                w["replaceable"].append({"code": p[0], "name": p[1], "unit": p[2], "qty": num(p[3])})
        mat_used.update(m["code"] for m in w["materials"])
        mach_used.update(m["code"] for m in w["machines"])
        works.append(w)
    materials = {}
    for r in tbl(ms):
        k = r["KOD22"]
        if k in mat_used and k not in materials:
            materials[k] = {"name": (r["NAIM"] or "").strip(), "unit": (r["PRM1"] or "").split("#")[0]}
    machines = {}
    for r in tbl(hs):
        k = r["OBOSN"]
        if k in mach_used:
            unit = [x for x in (r["PRM1"] or "").split("#") if x]
            machines[k] = {"name": (r["NAIM"] or "").strip(), "unit": unit[-1] if unit else ""}
    data = {"meta": {"source": "NRR-2022 (SmrPro)", "works": len(works), "sections": sorted(wanted) if wanted else "all"},
            "works": works, "materials": materials, "machines": machines}
    os.makedirs(out, exist_ok=True)
    p = os.path.join(out, "norms.json")
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    return p, data["meta"]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("raw"); ap.add_argument("out"); ap.add_argument("--sections", default="")
    a = ap.parse_args()
    secs = [s for s in a.sections.split(",") if s] or None
    p, meta = build(a.raw, a.out, secs)
    print(p, os.path.getsize(p), meta)
