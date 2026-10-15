"""Minimal reader for Visual FoxPro tables (.dbf/.dat + .fpt memo), standard library only.

Used by the norms pipeline inside the container, so it must not need third-party packages.
"""
import struct


class VfpTable:
    def __init__(self, dbf_path, fpt_path=None, encoding="cp1251"):
        self.enc = encoding
        with open(dbf_path, "rb") as f:
            self.buf = f.read()
        b = self.buf
        self.nrec, self.hdr_len, self.rec_len = struct.unpack_from("<IHH", b, 4)
        self.fields = []
        pos, off = 32, 1
        while b[pos] != 0x0D:
            name = b[pos:pos + 11].split(b"\0")[0].decode("ascii", "replace")
            typ = chr(b[pos + 11])
            ln, dec = b[pos + 16], b[pos + 17]
            self.fields.append((name, typ, off, ln, dec))
            off += ln
            pos += 32
        self.memo = None
        self.memo_block = 0
        if fpt_path:
            with open(fpt_path, "rb") as f:
                self.memo = f.read()
            self.memo_block = struct.unpack_from(">H", self.memo, 6)[0]

    def _memo(self, n):
        if not n or self.memo is None:
            return ""
        p = n * self.memo_block
        if p + 8 > len(self.memo):
            return ""
        _, ln = struct.unpack_from(">II", self.memo, p)
        return self.memo[p + 8:p + 8 + ln].decode(self.enc, "replace")

    def __iter__(self):
        b, rl = self.buf, self.rec_len
        for i in range(self.nrec):
            p = self.hdr_len + i * rl
            if b[p] == 0x2A:  # deleted
                continue
            row = {}
            for name, typ, off, ln, dec in self.fields:
                raw = b[p + off:p + off + ln]
                if typ == "C":
                    row[name] = raw.decode(self.enc, "replace").rstrip(" \0")
                elif typ == "M":
                    row[name] = self._memo(struct.unpack("<I", raw)[0]) if ln == 4 else ""
                elif typ == "I":
                    row[name] = struct.unpack("<i", raw)[0]
                elif typ in "NF":
                    s = raw.decode("ascii", "replace").strip()
                    row[name] = float(s) if s else 0.0
                else:
                    row[name] = raw
            yield row
