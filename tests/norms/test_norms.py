"""Tests for the norms pipeline on synthetic FoxPro tables (no private data needed)."""
import json, os, struct, sys, tempfile, unittest, zipfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "tools", "norms"))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
from vfp import VfpTable
import build

BLOCK = 64


def write_table(path, fields, rows):
    """fields: [(name, 'C'|'M'|'I', length)]; rows: list of dicts. Writes path.dat and path.fpt."""
    memo = bytearray(b"\0" * 512)
    memo[6:8] = struct.pack(">H", BLOCK)
    memo.extend(b"\0" * (BLOCK * 8 - len(memo)))
    recs = bytearray()
    rl = 1 + sum(f[2] if f[1] != "M" else 4 for f in fields)
    for r in rows:
        rec = bytearray(b" ")
        for n, t, ln in fields:
            v = r.get(n, "")
            if t == "C":
                rec += v.encode("cp1251").ljust(ln, b" ")[:ln]
            elif t == "I":
                rec += struct.pack("<i", v)
            else:
                if v:
                    data = v.encode("cp1251")
                    blk = len(memo) // BLOCK
                    memo.extend(struct.pack(">II", 1, len(data)) + data)
                    memo.extend(b"\0" * (-len(memo) % BLOCK))
                    rec += struct.pack("<I", blk)
                else:
                    rec += struct.pack("<I", 0)
        recs += rec
    hdr = bytearray(32)
    hdr[0] = 0x30
    struct.pack_into("<IHH", hdr, 4, len(rows), 32 + 32 * len(fields) + 1, rl)
    fd = bytearray()
    off = 1
    for n, t, ln in fields:
        l = ln if t != "M" else 4
        e = bytearray(32)
        e[:len(n)] = n.encode()
        e[11] = ord(t); e[16] = l
        fd += e
        off += l
    with open(path + ".dat", "wb") as fh:
        fh.write(bytes(hdr) + bytes(fd) + b"\x0d" + bytes(recs))
    with open(path + ".fpt", "wb") as fh:
        fh.write(bytes(memo))


class NormsTest(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        write_table(os.path.join(self.d, "rscer"),
                    [("OBOSN", "C", 15), ("NAIM", "M", 4), ("PRM", "M", 4), ("MAT", "M", 4), ("MEH", "M", 4), ("RNMAT", "M", 4), ("TXT", "M", 4)],
                    [{"OBOSN": "Е15-298-1*", "NAIM": "Облицовка плиткой", "PRM": "100 М2 ПОВЕРХНОСТИ##196.740#4.20###0.140#",
                      "MAT": "1/10-1~102#1/10-2~0.36#", "MEH": "М031110~0.14#",
                      "RNMAT": "1/10-9'Фуга'КГ'45'2#", "TXT": "а) разметка;\rб) укладка"},
                     {"OBOSN": "Е1-10-1", "NAIM": "Земляные", "PRM": "1000М3##1.8#4.3###9.5#", "MAT": "", "MEH": "", "RNMAT": "", "TXT": ""}])
        write_table(os.path.join(self.d, "mat"),
                    [("OBOSN", "C", 15), ("NAIM", "M", 4), ("PRM1", "M", 4), ("KOD22", "C", 30)],
                    [{"OBOSN": "С1", "NAIM": "Плитка", "PRM1": "м2#1/10-1#13#", "KOD22": "1/10-1"},
                     {"OBOSN": "С2", "NAIM": "Смесь", "PRM1": "т#1/10-2#13#", "KOD22": "1/10-2"}])
        write_table(os.path.join(self.d, "meh"),
                    [("OBOSN", "C", 15), ("NAIM", "M", 4), ("PRM1", "M", 4)],
                    [{"OBOSN": "М031110", "NAIM": "Подъёмник", "PRM1": "##1##15#1#МАШ.-Ч#"}])

    def test_reader(self):
        rows = list(VfpTable(os.path.join(self.d, "rscer.dat"), os.path.join(self.d, "rscer.fpt")))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["OBOSN"], "Е15-298-1*")
        self.assertEqual(rows[0]["TXT"], "а) разметка;\rб) укладка")

    def test_build(self):
        out = os.path.join(self.d, "out")
        path, meta = build.build(self.d, out, ["Е15"])
        data = json.load(open(path, encoding="utf-8"))
        self.assertEqual(meta["works"], 1)
        w = data["works"][0]
        self.assertEqual((w["per"], w["unit"]), (100.0, "М2 ПОВЕРХНОСТИ"))
        self.assertAlmostEqual(w["labor_h"], 196.74)
        self.assertEqual(w["scope"], ["а) разметка;", "б) укладка"])
        self.assertEqual([m["code"] for m in w["materials"]], ["1/10-1", "1/10-2"])
        self.assertEqual(w["replaceable"][0]["qty"], 45.0)
        self.assertEqual(data["materials"]["1/10-1"]["unit"], "м2")
        self.assertEqual(data["machines"]["М031110"]["unit"], "МАШ.-Ч")

    def test_all_sections(self):
        _, meta = build.build(self.d, os.path.join(self.d, "o2"))
        self.assertEqual(meta["works"], 2)

    def test_fetch_decrypt_build(self):
        import shutil, subprocess, sys
        if not (shutil.which("age") and shutil.which("age-keygen")):
            self.skipTest("age not installed")
        kg = subprocess.run(["age-keygen"], capture_output=True, text=True).stdout
        secret = [l for l in kg.splitlines() if l.startswith("AGE-SECRET-KEY-")][0]
        pub = [l for l in kg.splitlines() if "public key" in l][0].split(": ")[1]
        zp = os.path.join(self.d, "b.zip")
        with zipfile.ZipFile(zp, "w") as z:
            for n in os.listdir(self.d):
                if n.lower().split(".")[0] in ("rscer", "mat", "meh"):
                    z.write(os.path.join(self.d, n), n)
            z.writestr("tech/x.rtf", "{\\rtf1}")
        enc = os.path.join(self.d, "b.zip.age")
        subprocess.run(["age", "-r", pub, "-o", enc, zp], check=True)
        out = os.path.join(self.d, "shm")
        env = dict(os.environ, NORMS_AGE_KEY=secret, NORMS_BUNDLE_FILE=enc, NORMS_OUT=out)
        r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "tools/norms/fetch.py")],
                           env=env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(len(json.load(open(os.path.join(out, "norms.json"), encoding="utf-8"))["works"]), 2)
        self.assertNotIn("AGE-SECRET", r.stdout + r.stderr)
        env["NORMS_AGE_KEY"] = "AGE-SECRET" + "-KEY-1" + "Q" * 58
        r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "tools/norms/fetch.py")],
                           env=env, capture_output=True, text=True)
        self.assertNotEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
