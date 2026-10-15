#!/usr/bin/env python3
"""Container start-up step: download the encrypted norms bundle, decrypt it, build norms.json.

Env (all optional; without them the step is skipped and the site runs without the library):
  NORMS_AGE_KEY       age secret key (AGE-SECRET-KEY-1...)  -- never logged
  CONTENT_READ_TOKEN  read-only GitHub token for the private content repo
  CONTENT_REPO        default ShkodnikAI/tega-content
  CONTENT_REF         default main (used for the fallback file norms/norms.zip.age)
  NORMS_OUT           default /dev/shm/norms
Source order: latest GitHub release asset `norms.zip.age`, else repo file norms/norms.zip.age.
Decrypted raw tables are unpacked to a temp dir, normalized by build.py, and removed.
"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
NEED = {"rscer.dat", "rscer.fpt", "mat.dat", "mat.fpt", "meh.dat", "meh.fpt"}


def log(msg):
    print("[norms] " + msg, flush=True)


def api(url, token, accept="application/vnd.github+json"):
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "Accept": accept,
                                               "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "tega-site"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def download(repo, ref, token):
    try:
        rel = json.loads(api("https://api.github.com/repos/%s/releases/latest" % repo, token))
        for a in rel.get("assets", []):
            if a["name"] == "norms.zip.age":
                log("source: release %s" % rel.get("tag_name"))
                return api(a["url"], token, "application/octet-stream")
    except Exception as e:  # no release yet is normal
        log("no release asset (%s)" % type(e).__name__)
    log("source: repo file @%s" % ref)
    return api("https://api.github.com/repos/%s/contents/norms/norms.zip.age?ref=%s" % (repo, ref),
              token, "application/vnd.github.raw")


def main():
    key = os.environ.get("NORMS_AGE_KEY", "").strip()
    token = os.environ.get("CONTENT_READ_TOKEN", "").strip()
    local = os.environ.get("NORMS_BUNDLE_FILE")  # test hook: encrypted bundle on disk instead of GitHub
    if not key or not (token or local):
        log("NORMS_AGE_KEY / CONTENT_READ_TOKEN not set: skipped")
        return 0
    out_dir = os.environ.get("NORMS_OUT", "/dev/shm/norms")
    repo = os.environ.get("CONTENT_REPO", "ShkodnikAI/tega-content")
    ref = os.environ.get("CONTENT_REF", "main")
    t0 = time.time()
    work = tempfile.mkdtemp(prefix="norms-")
    os.chmod(work, 0o700)
    try:
        if local:
            blob = open(local, "rb").read()
        else:
            blob = download(repo, ref, token)
        enc = os.path.join(work, "n.age")
        with open(enc, "wb") as f:
            f.write(blob)
        ident = os.path.join(work, "id.txt")
        fd = os.open(ident, os.O_WRONLY | os.O_CREAT, 0o600)
        with os.fdopen(fd, "w") as f:
            f.write(key + "\n")
        zpath = os.path.join(work, "n.zip")
        r = subprocess.run(["age", "-d", "-i", ident, "-o", zpath, enc], capture_output=True)
        os.remove(ident)
        if r.returncode != 0:
            log("decrypt failed (wrong key or damaged bundle)")
            return 1
        raw = os.path.join(work, "raw")
        os.mkdir(raw)
        with zipfile.ZipFile(zpath) as z:
            for n in z.namelist():
                base = n.replace("\\", "/").split("/")[-1]
                if base.lower() in NEED:
                    with z.open(n) as src, open(os.path.join(raw, base), "wb") as dst:
                        shutil.copyfileobj(src, dst)
        os.remove(zpath)
        os.makedirs(out_dir, mode=0o700, exist_ok=True)
        r = subprocess.run([sys.executable, "-I", os.path.join(HERE, "build.py"), raw, work + "/out"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            log("build failed: " + r.stderr[-300:])
            return 1
        os.replace(work + "/out/norms.json", os.path.join(out_dir, "norms.json"))
        with open(os.path.join(out_dir, "norms.json"), encoding="utf-8") as f:
            d = json.load(f)
        log("ready: %d works, %d materials, %d machines in %.0fs" %
            (len(d["works"]), len(d["materials"]), len(d["machines"]), time.time() - t0))
        return 0
    except Exception as e:
        import traceback
        tb = traceback.extract_tb(e.__traceback__)[-1]
        log("failed: %s errno=%s at %s:%d %s" % (type(e).__name__, getattr(e, "errno", None),
                                                  os.path.basename(tb.filename), tb.lineno, tb.name))
        return 1
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
